FROM python:3.9-slim

WORKDIR /bot

COPY requirements.txt .

RUN apt-get update && \
    apt-get install -y ffmpeg libopus0 && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

COPY . /bot

EXPOSE 5000

CMD ["python", "src/bot.py"]
