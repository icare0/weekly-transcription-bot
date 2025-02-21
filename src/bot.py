import discord
import os
import pydub
import utils
import dotenv

dotenv.load_dotenv()
TOKEN = os.getenv("DISCORD_APP_TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID"))
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

intents = discord.Intents.default()
intents.voice_states = True
bot = discord.Bot(intents=intents)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
MEETINGS_PATH = os.path.join(ROOT_DIR, "meetings")
os.makedirs(MEETINGS_PATH, exist_ok=True)

MEETINGS = utils.meetings_info(MEETINGS_PATH)

@bot.event
async def on_ready():
    print(f"✅ Bot online as {bot.user}")
    await bot.sync_commands(force=True)
    print("🔄 Commands synced")
    print(f"📜 Registered commands: {[cmd.name for cmd in bot.application_commands]}")
    print(f"📂 Registered meetings: {[meeting['name'] for meeting in MEETINGS]}")
    
@bot.slash_command(
    name="start_recording",
    description="Starts recording audio from the voice channel.",
    guild_ids=[GUILD_ID]
)
@discord.option("name", str, description="The name of the meeting", required=True)
async def start_recording_(ctx: discord.ApplicationContext, meeting_name: str):
    if meeting_name in [meeting['name'] for meeting in MEETINGS if meeting['recorded'] or meeting['transcribed'] or meeting['summarized']]:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` already exists")
    
    if ctx.author.voice:
        channel = ctx.author.voice.channel
        await channel.connect()
        print(f"🎙️ Bot joined vc: {channel.name}")
    else:
        return await ctx.respond("⚠️ You need to be in a voice channel to start recording")

    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    os.makedirs(meeting_path, exist_ok=True)

    if ctx.voice_client:
        sink = discord.sinks.MP3Sink()
        ctx.voice_client.start_recording(
            sink,
            finished_callback,
            (ctx, meeting_path, meeting_name)
        )
        await ctx.respond(f"🔴 Started recording meeting `{meeting_name}` on voice channel `{channel.name}`")
    else:
        await ctx.respond("⚠️ Bot is not in a voice channel!")

async def finished_callback(sink: discord.sinks.MP3Sink, context: tuple):
    _, meeting_path, meeting_name = context
    print(f"🔧 Processing the recording for meeting: {meeting_path}")

    if not sink.audio_data:
        print("⚠️ No audio data")
        return

    audio_segs: list[pydub.AudioSegment] = []
    longest = pydub.AudioSegment.empty()

    for user_id, audio in sink.audio_data.items():
        print(f"🔧 Processing audio data for user: {user_id}")
        audio.file.seek(0)
        seg = pydub.AudioSegment.from_file(audio.file, format="mp3")

        if len(seg) > len(longest):
            audio_segs.append(longest)
            longest = seg
        else:
            audio_segs.append(seg)

    for seg in audio_segs:
        longest = longest.overlay(seg)
    
    output_path = os.path.join(meeting_path, f"{meeting_name}.wav")
    longest.export(output_path, format="wav")
    
    MEETINGS.append({
        'name': meeting_name,
        'recorded': True,
        'transcribed': False,
        'summarized': False
    })
    
    print(f"✅ Recording saved: {output_path}")

@bot.slash_command(
    name="stop_recording",
    description="Stops recording audio from the voice channel",
    guild_ids=[GUILD_ID]
)
async def stop_recording_(ctx: discord.ApplicationContext):
    vc: discord.VoiceClient = ctx.voice_client

    if not vc:
        return await ctx.respond("⚠️ Bot is not recording")

    vc.stop_recording()
    await vc.disconnect()
    await ctx.respond("🛑 Recording stopped")
    
@bot.slash_command(
    name="saved_meetings",
    description="Display saved meetings data",
    guild_ids=[GUILD_ID]
)
async def saved_meetings_(ctx: discord.ApplicationContext):
    if not MEETINGS:
        return await ctx.respond("❌ No meetings saved")
    
    meetings_info = "\n".join([(
        f"📅 {meeting['name']} - "
        f"Recorded: {'✅' if meeting['recorded'] else '❌'}, "
        f"Transcribed: {'✅' if meeting['transcribed'] else '❌'}, "
        f"Summarized: {'✅' if meeting['summarized'] else '❌'}"
        ) for meeting in MEETINGS
    ])
    
    await ctx.respond(f"📂 Saved meetings:\n```{meetings_info}```")
    
        
@bot.slash_command(
    name="transcribe",
    description="Transcribe saved recording",
    guild_ids=[GUILD_ID]
)
@discord.option("name", str, description="The name of the meeting", required=True)
async def transcribe_(ctx: discord.ApplicationContext, meeting_name: str):
    await ctx.defer()
    
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")

    if not meeting['recorded']:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` has not been recorded")
    
    if meeting['transcribed']:
        return await ctx.respond(f"✅ Meeting `{meeting_name}` has already been transcribed")

    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    audio_path = os.path.join(meeting_path, f"{meeting_name}.wav")

    if not os.path.exists(audio_path):
        return await ctx.respond(f"❌ No recording for meeting `{meeting_name}`")

    message = await ctx.respond("🔄 Transcribing...")
    
    transcription = utils.transcribe(audio_path, OPENAI_API_KEY, split_size=24)
    txt_output_path = os.path.join(meeting_path, f"{meeting_name}.txt")
    utils.save_transcription(transcription, txt_output_path)
    
    for m in MEETINGS:
        if m['name'] == meeting_name:
            m['transcribed'] = True
    
    await message.edit(content=f"✅ Transcription saved")
    
@bot.slash_command(
    name="summarize",
    description="Summarize saved transcription of the meeting",
    guild_ids=[GUILD_ID]
)
@discord.option("name", str, description="The name of the meeting", required=True)
async def summarize_(ctx: discord.ApplicationContext, meeting_name: str):
    await ctx.defer()
    
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")
    
    if not meeting['transcribed']:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` has not been transcribed")
    
    if meeting['summarized']:
        return await ctx.respond(f"✅ Meeting `{meeting_name}` has already been summarized")
    
    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    txt_path = os.path.join(meeting_path, f"{meeting_name}.txt")
    
    if not os.path.exists(txt_path):
        return await ctx.respond(f"❌ No transcription for meeting `{meeting_name}`")
    
    message = await ctx.respond("🔄 Summarizing...")
    
    summary = utils.summarize_transcription(txt_path, OPENAI_API_KEY)
    md_output_path = os.path.join(meeting_path, f"{meeting_name}.md")
    utils.save_summary(summary, md_output_path)
        
    for m in MEETINGS:
        if m['name'] == meeting_name:
            m['summarized'] = True
    
    await message.edit(content=f"✅ Summary saved")
    
@bot.slash_command(
    name="send_recording",
    description="Send saved recording",
    guild_ids=[GUILD_ID]
)
@discord.option("name", str, description="The name of the meeting", required=True)
async def send_recording_(ctx: discord.ApplicationContext, meeting_name: str):
    ctx.defer()
    
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")

    if not meeting['recorded']:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` has not been recorded")
    
    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    audio_path = os.path.join(meeting_path, f"{meeting_name}.wav")

    if not os.path.exists(audio_path):
        return await ctx.respond(f"❌ No recording for meeting `{meeting_name}`")

    message = await ctx.respond("🔄 Sending recording...")
    await message.edit_original_response(content="", file=discord.File(audio_path))
    
@bot.slash_command(
    name="send_transcription",
    description="Send saved transcription",
    guild_ids=[GUILD_ID]
)
@discord.option("name", str, description="The name of the meeting", required=True)
async def send_transcription_(ctx: discord.ApplicationContext, meeting_name: str):
    ctx.defer()
    
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")
    
    if not meeting['transcribed']:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` has not been transcribed")
    
    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    txt_path = os.path.join(meeting_path, f"{meeting_name}.txt")
    
    if not os.path.exists(txt_path):
        return await ctx.respond(f"❌ No transcription for meeting `{meeting_name}`")
    
    message = await ctx.respond("🔄 Sending transcription...")
    await message.edit_original_response(content="", file=discord.File(txt_path))
    
@bot.slash_command(
    name="send_summary",
    description="Send saved summary",
    guild_ids=[GUILD_ID]
)
@discord.option("name", str, description="The name of the meeting", required=True)
async def send_summary_(ctx: discord.ApplicationContext, meeting_name: str):
    ctx.defer()
    
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")
    
    if not meeting['summarized']:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` has not been summarized")
    
    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    md_path = os.path.join(meeting_path, f"{meeting_name}.md")
    
    if not os.path.exists(md_path):
        return await ctx.respond(f"❌ No summary for meeting `{meeting_name}`")
    
    message = await ctx.respond("🔄 Sending summary...")
    await message.edit_original_response(content="", file=discord.File(md_path))
    
@bot.slash_command(
    name="delete_recording",
    description="Delete saved recording",
    guild_ids=[GUILD_ID]
)
@discord.option("name", str, description="The name of the meeting", required=True)
async def delete_recording_(ctx: discord.ApplicationContext, meeting_name: str):
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")

    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    audio_path = os.path.join(meeting_path, f"{meeting_name}.wav")

    if os.path.exists(audio_path):
        os.remove(audio_path)
        meeting['recorded'] = False
        return await ctx.respond(f"✅ Recording `{meeting_name}` deleted")
    else:
        return await ctx.respond(f"❌ No recording for meeting `{meeting_name}`")

@bot.slash_command(
    name="delete_transcription",
    description="Delete saved transcription",
    guild_ids=[GUILD_ID]
)
@discord.option("name", str, description="The name of the meeting", required=True)
async def delete_transcription_(ctx: discord.ApplicationContext, meeting_name: str):
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")

    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    txt_path = os.path.join(meeting_path, f"{meeting_name}.txt")

    if os.path.exists(txt_path):
        os.remove(txt_path)
        meeting['transcribed'] = False
        return await ctx.respond(f"✅ Transcription `{meeting_name}` deleted")
    else:
        return await ctx.respond(f"❌ No transcription for meeting `{meeting_name}`")

@bot.slash_command(
    name="delete_summary",
    description="Delete saved summary",
    guild_ids=[GUILD_ID]
)
@discord.option("name", str, description="The name of the meeting", required=True)
async def delete_summary_(ctx: discord.ApplicationContext, meeting_name: str):
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")

    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    md_path = os.path.join(meeting_path, f"{meeting_name}.md")

    if os.path.exists(md_path):
        os.remove(md_path)
        meeting['summarized'] = False
        return await ctx.respond(f"✅ Summary `{meeting_name}` deleted")
    else:
        return await ctx.respond(f"❌ No summary for meeting `{meeting_name}`")
    
@bot.slash_command(
    name="delete_meeting",
    description="Delete saved meeting",
    guild_ids=[GUILD_ID]
)
@discord.option("name", str, description="The name of the meeting", required=True)
async def delete_meeting_(ctx: discord.ApplicationContext, meeting_name: str):
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")

    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    audio_path = os.path.join(meeting_path, f"{meeting_name}.wav")
    txt_path = os.path.join(meeting_path, f"{meeting_name}.txt")
    md_path = os.path.join(meeting_path, f"{meeting_name}.md")

    if os.path.exists(audio_path):
        os.remove(audio_path)
        meeting['recorded'] = False

    if os.path.exists(txt_path):
        os.remove(txt_path)
        meeting['transcribed'] = False

    if os.path.exists(md_path):
        os.remove(md_path)
        meeting['summarized'] = False
        
    os.rmdir(meeting_path)
    MEETINGS.remove(meeting)
    
    return await ctx.respond(f"✅ Meeting `{meeting_name}` deleted")


bot.run(TOKEN)