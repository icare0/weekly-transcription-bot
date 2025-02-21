from typing import List, Dict
from pydub import AudioSegment
from openai import OpenAI
import math, os

def meetings_info(meetings_dir: str) -> List[Dict]:
    meetings_info = []
    
    for meeting_folder in os.listdir(meetings_dir):
        folder_path = os.path.join(meetings_dir, meeting_folder)
        
        if os.path.isdir(folder_path):
            contains_wav = False
            contains_md = False
            contains_txt = False

            for file_name in os.listdir(folder_path):
                if file_name.endswith('.wav'):
                    contains_wav = True
                elif file_name.endswith('.md'):
                    contains_md = True
                elif file_name.endswith('.txt'):
                    contains_txt = True
                    
            meetings_info.append({
                'name': meeting_folder,
                'recorded': contains_wav,
                'transcribed': contains_txt,
                'summarized': contains_md
            })
    
    return meetings_info

def split_audio(file_path: str, max_size_mb=25) -> List[str]:
    audio = AudioSegment.from_wav(file_path)
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    
    if file_size_mb < max_size_mb:
        return [file_path]
    
    num_chunks = math.ceil(file_size_mb / max_size_mb)
    chunk_length_ms = len(audio) / num_chunks

    chunk_paths = []
    for i in range(num_chunks):
        start_ms = i * chunk_length_ms
        end_ms = start_ms + chunk_length_ms
        chunk = audio[start_ms:end_ms]
        
        chunk_path = f"{file_path}_chunk_{i+1}.wav"
        chunk.export(chunk_path, format="wav")
        chunk_paths.append(chunk_path)
    
    return chunk_paths

def transcribe_audio(file_path: str, openai_client: OpenAI):   
    print(f"🔄 Transcribing file: {file_path}")
    
    with open(file_path, "rb") as audio_file:
        response = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="pl",
        )
        
    print(f"✅ Transcribed file: {file_path}")

    return response

def transcribe(file_path, openai_api_key: str, split_size=25):
    chunk_paths = split_audio(file_path, split_size)
    full_transcription = ""
    
    client = OpenAI(api_key=openai_api_key)

    print(f"🔄 Transcription started: {file_path}")
    
    for chunk_path in chunk_paths:
        print(f"⬆️ Uploading file: {chunk_path}")
        response = transcribe_audio(chunk_path, client)
        transcription_text = response.text
        full_transcription += transcription_text + " "

        if len(chunk_paths) > 1:
            os.remove(chunk_path)
    
    print(f"✅ Transcription completed: {file_path}")
    
    return full_transcription

def save_transcription(transcription: str, output_path: str):
    with open(output_path, "w", encoding="utf-8") as txt_file:
        txt_file.write(transcription)
        
    print(f"✅ Transcription saved: {output_path}")
        
def summarize_transcription(transcription_path: str, openai_api_key: str):
    client = OpenAI(api_key=openai_api_key)
    
    prompt = (
        "Jesteś profesjonalnym asystentem, który dokładnie podsumowuje transkrypcję cotygodniowego spotkania Solvro Weekly koła naukowego Solvro. "
        "Twoim celem jest stworzenie szczegółowego, ale czytelnego podsumowania, które zawiera wszystkie kluczowe informacje. "
        "Podsumowanie powinno zawierać:\n"
        "- 📌 **Główne tematy spotkania** – co zostało omówione?\n"
        "- ✅ **Podjęte decyzje** – jakie wnioski i decyzje zapadły?\n"
        "- 📝 **Zadania do wykonania** – kto jest odpowiedzialny za konkretne działania?\n"
        "- ⏭️ **Plany na przyszłość** – co zaplanowano na kolejne spotkania lub działania?\n"
        "- 🔹 **Dodatkowe istotne informacje** – np. problemy, wyzwania, sugestie.\n\n"
        "Podsumowanie powinno być dobrze zorganizowane, logicznie uporządkowane i zawierać wszystkie istotne szczegóły. "
        "Podsumowanie powinno byc w formacie .md (Markdown) dostosowanym do możliwości Discord. "
        "Nie pomijaj ważnych informacji, ale staraj się unikać nadmiernych szczegółów i powtórzeń. "
        "Zachowaj profesjonalny i przejrzysty styl. "
        "Nie halucynuj, nie przeklinaj, nie używaj wulgaryzmów. "
        "Na spotkaniach omawiane będa osiągnięcia z poprzedniego tygodnia zespołów: "
        "Aplikacja ToPWR, Planer, Cube3D/Led Cube, Aplikacja i strona Juwenalia, Strona katedry W4, Eventownik, Promochator. "
    )
    
    print(f"🔄 Summarizing transcription")
    with open(transcription_path, "r", encoding="utf-8") as txt_file:
        response = client.chat.completions.create(
            model="gpt-4o", # byl gpt-3.5-turbo
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Podsumuj tę transkrypcję:\n{txt_file.read()}"}
            ]
        )

    print(f"✅ Summarized transcription")
    return response.choices[0].message.content

def save_summary(summary: str, output_path: str):
    with open(output_path, "w", encoding="utf-8") as md_file:
        md_file.write(summary)

    print(f"✅ Summary saved: {output_path}")
    
def split_summary(summary: str) -> List[str]:
    blocks = []
    block = ""
    for line in summary.split("\n"):
        if len(block) + len(line) > 2000:
            blocks.append(block)
            block = ""
        block += line + "\n"
    if block:
        blocks.append(block)
    return blocks
