import discord
from discord.ext import commands
import os
import pydub
from pydub.utils import which
import utils
import dotenv

pydub.AudioSegment.converter = which("ffmpeg")

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

ALLOWED_ROLES = ['Admin', 'Przewodniczący sekcji', 'Weekly Transcription Bot Operator']
IDLING_MESSAGE = "🗿 Pretends to listen"
RECORDING_MESSAGE = "👂🏼 Capturing every word"

async def meetings_autocomplete(ctx: discord.AutocompleteContext):
    return [m['name'] for m in MEETINGS]

@bot.listen(once=True)
async def on_ready():
    print(f"Bot online as {bot.user}")
    await bot.sync_commands(force=True)
    activity = discord.Game(name=IDLING_MESSAGE)
    await bot.change_presence(status=discord.Status.online, activity=activity)
    
@bot.slash_command(
    name="start_meeting",
    description="Starts recording audio from the voice channel.",
    guild_ids=[GUILD_ID]
)
@commands.has_any_role(*ALLOWED_ROLES)
async def start_meeting_(
    ctx: discord.ApplicationContext,
    meeting_name: str = discord.Option(
        input_type=str,
        name="meeting_name",
        description="The name of the meeting",
        required=True
    )
):
    if meeting_name in [meeting['name'] for meeting in MEETINGS if meeting['recorded'] or meeting['transcribed'] or meeting['summarized']]:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` already exists")
    
    if ctx.author.voice:
        channel = ctx.author.voice.channel
        await channel.connect()
        await ctx.guild.me.edit(mute=True)
    else:
        return await ctx.respond("⚠️ You need to be in a voice channel to start recording the meeting")

    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    os.makedirs(meeting_path, exist_ok=True)
    
    MEETINGS.append({
        'name': meeting_name,
        'recorded': False,
        'transcribed': False,
        'summarized': False
    })

    if ctx.voice_client:
        ctx.voice_client.start_recording(
            (meeting_path, meeting_name),
            sink=discord.sinks.MP3Sink(),
            callback=merge_recordings,
            sync_start=True
        )
        await ctx.respond(f"🔴 Started recording the meeting `{meeting_name}` in a voice channel `{channel.name}`")
        
        activity = discord.Game(name=RECORDING_MESSAGE)
        await bot.change_presence(status=discord.Status.dnd, activity=activity)
    else:
        await ctx.respond("⚠️ Bot is not in a voice channel")

async def merge_recordings(sink: discord.sinks.MP3Sink, args: tuple):
    meeting_path, meeting_name = args

    if not sink.audio_data: return

    audio_segs: list[pydub.AudioSegment] = []
    longest = pydub.AudioSegment.empty()

    for _, audio in sink.audio_data.items():
        audio.file.seek(0)
        seg = pydub.AudioSegment.from_file(audio.file, format="mp3")

        if len(seg) > len(longest):
            audio_segs.append(longest)
            longest = seg
        else:
            audio_segs.append(seg)

    for seg in audio_segs:
        longest = longest.overlay(seg)
    
    output_path = os.path.join(meeting_path, f"{meeting_name}.mp3")
    longest.export(output_path, format="mp3")
    
    MEETINGS[-1]['recorded'] = True

@bot.slash_command(
    name="stop_meeting",
    description="Stops current recording, transcribes and summarizes the meeting",
    guild_ids=[GUILD_ID]
)
@commands.has_any_role(*ALLOWED_ROLES)
async def stop_recording_(ctx: discord.ApplicationContext):
    await ctx.defer()
    
    vc: discord.VoiceClient = ctx.voice_client

    if not vc:
        return await ctx.respond("⚠️ Bot is not recording any meeting right now")

    vc.stop_recording()
    await vc.disconnect()
    message = await ctx.respond("🛑 Recording stopped")
    
    activity = discord.Game(name=IDLING_MESSAGE)
    await bot.change_presence(status=discord.Status.online, activity=activity)
    
    meeting_name = MEETINGS[-1]['name']
    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    audio_path = os.path.join(meeting_path, f"{meeting_name}.mp3")
    
    if not os.path.exists(audio_path):
        MEETINGS.pop()
        os.rmdir(meeting_path)
        return await message.edit(content="❌ No recording found or recording was empty")
    
    await message.edit(content="🔄 Transcribing...")
    
    transcription = utils.transcribe(audio_path, OPENAI_API_KEY, split_size=24)
    txt_output_path = os.path.join(meeting_path, f"{meeting_name}.txt")
    utils.save_transcription(transcription, txt_output_path)
    
    MEETINGS[-1]['transcribed'] = True
    
    await message.edit(content="🔄 Summarizing...")
    
    summary = utils.summarize_transcription(txt_output_path, OPENAI_API_KEY)
    md_output_path = os.path.join(meeting_path, f"{meeting_name}.md")
    utils.save_summary(summary, md_output_path)
    
    MEETINGS[-1]['summarized'] = True
    
    await message.edit(content="✅ Transcription and summary done")
    
    with open(md_output_path, "r", encoding="utf-8") as file:
        blocks = utils.split_summary(file.read())
        for block in blocks:
            await ctx.send(block)
    
@bot.slash_command(
    name="saved_meetings",
    description="Prints list of saved meetings",
    guild_ids=[GUILD_ID]
)
@commands.has_any_role(*ALLOWED_ROLES)
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
    name="send_transcription",
    description="Sends transcription of the meeting",
    guild_ids=[GUILD_ID]
)
@commands.has_any_role(*ALLOWED_ROLES)
async def send_transcription_(
    ctx: discord.ApplicationContext,
    meeting_name: str = discord.Option(
        input_type=str,
        name="meeting_name",
        description="The name of the meeting",
        required=True,
        autocomplete=meetings_autocomplete
    )
):
    await ctx.defer()
    
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
    return await message.edit(content="", file=discord.File(txt_path))

@bot.slash_command(
    name="send_summary",
    description="Sends summary of the meeting",
    guild_ids=[GUILD_ID]
)
@commands.has_any_role(*ALLOWED_ROLES)
async def send_summary_(
    ctx: discord.ApplicationContext,
    meeting_name: str = discord.Option(input_type=str,
        name="meeting_name",
        description="The name of the meeting",
        required=True,
        autocomplete=meetings_autocomplete
    ),
    type_: str = discord.Option(
        input_type=str,
        name="output_type",
        description="Type of output",
        required=True,
        choices=["message", "file"],
    )
):
    await ctx.defer()
    
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
    if type_ == "file":
        return await message.edit(content="", file=discord.File(md_path))
    
    with open(md_path, "r", encoding="utf-8") as file:
        blocks = utils.split_summary(file.read())
        await message.edit(content="✅ Summary ready")
        for block in blocks:
            await ctx.send(block)

@bot.slash_command(
    name="delete_recording",
    description="Deletes recording of the meeting",
    guild_ids=[GUILD_ID]
)
@commands.has_any_role(*ALLOWED_ROLES)
async def delete_recording_(
    ctx: discord.ApplicationContext,
    meeting_name: str = discord.Option(
        input_type=str,
        name="meeting_name",
        description="The name of the meeting",
        required=True,
        autocomplete=meetings_autocomplete
    ),
):
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")

    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    audio_path = os.path.join(meeting_path, f"{meeting_name}.mp3")

    if os.path.exists(audio_path):
        os.remove(audio_path)
        meeting['recorded'] = False
        return await ctx.respond(f"✅ Recording `{meeting_name}` deleted")
    else:
        return await ctx.respond(f"❌ No recording for meeting `{meeting_name}`")

@bot.slash_command(
    name="delete_meeting",
    description="Deletes whole meeting",
    guild_ids=[GUILD_ID]
)
@commands.has_any_role(*ALLOWED_ROLES)
async def delete_meeting_(
    ctx: discord.ApplicationContext,
    meeting_name: str = discord.Option(
        input_type=str,
        name="meeting_name",
        description="The name of the meeting",
        required=True,
        autocomplete=meetings_autocomplete
    )
):
    meeting = next((m for m in MEETINGS if m['name'] == meeting_name), None)

    if not meeting:
        return await ctx.respond(f"❌ Meeting `{meeting_name}` not found")

    meeting_path = os.path.join(MEETINGS_PATH, meeting_name)
    audio_path = os.path.join(meeting_path, f"{meeting_name}.mp3")
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

@start_meeting_.error
@stop_recording_.error
@saved_meetings_.error
@send_transcription_.error
@send_summary_.error
@delete_recording_.error
@delete_meeting_.error
async def restricted_error(ctx, error):
    if isinstance(error, commands.MissingRole | commands.MissingAnyRole):
        await ctx.send("⛔ No permissions to use this command")

bot.run(TOKEN)