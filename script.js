// ############################### Code ###############################

var button = document.getElementsByClassName("record-button")[0];
button?.addEventListener("click", startRecording);

var text = document.getElementById("text-span");

var imgDiv = document.getElementById("img-div");

var loader = document.getElementById("loader-div");

var isRecording = false;
var mediaRecorder = null;
var stream = null;

async function startRecording() {
    if (!isRecording) {
        text.innerHTML = "Recording...";
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        const audioChunks = [];

        mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            sendAudioToServer(audioBlob);
        };
        mediaRecorder.start();
        isRecording = true;
        console.log("Recording started...");
    }
    else {
        text.innerHTML = "";
        mediaRecorder.stop();
        isRecording = false;
        console.log("Recording stopped...");

        // End Microphone Access
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
    }
}

async function sendAudioToServer(audioBlob) {
    try {
        loader.style.display = "flex";
        const response = await fetch('http://localhost:3000/uploadaudio', {
            method: 'POST',
            headers: {
                'Content-Type': 'audio/webm' // Mime Type of Audioblob
            },
            body: audioBlob
        });

        if (response.ok) {
            loader.style.display = "none";
            var result = await response.text();
            text.innerHTML += result;
            // added new Button via Server, add EventListener to that Button
            var transcriptbutton = document.getElementsByClassName("record-button")[1];
            transcriptbutton?.addEventListener("click", sendTranscriptToServer);
        } else {
            loader.style.display = "none";
            console.error('Fehler beim Senden des Audios:', response.statusText);
        }
    } catch (error) {
        loader.style.display = "none";
        console.error('Fehler beim Senden der Anfrage:', error);
    }
}

async function sendTranscriptToServer() {
    try {
        loader.style.display = "flex";
        var transcript = document.getElementById("transcript-text")?.innerHTML;

        console.log(transcript);
        const response = await fetch('http://localhost:3000/uploadtranscript', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/html'
            },
            body: transcript
        });

        if (response.ok) {
            loader.style.display = "none";

            var result = await response.text();
            text.innerHTML += result;
        } else {
            loader.style.display = "none";
            console.error('Fehler beim Senden der Anfrage:', response.statusText);
        }
    } catch (error) {
        loader.style.display = "none";
        console.error('Fehler beim Senden der Anfrage:', error);
    }
}

