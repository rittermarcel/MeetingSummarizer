// ############################### Initialize ###############################
// Importing required libraries
import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import puppeteer from 'puppeteer';

dotenv.config();

const app = express();
const port = 3000;

// ############################ Server Code #############################

// Allow Cross Domain from LiveServer + Middleware to process binary data (Raw Body) and string
app.use(cors({
    origin: 'http://127.0.0.1:5500' // Allows only cross referencing from this domain (VSCode Live Server)
}));
app.use(express.raw({ type: 'audio/webm', limit: '10mb' }));
app.use(express.text({ type: 'text/html', limit: '1mb' }));

// Route to receive audio blob
app.post('/uploadaudio', async (req, res) => {
    try {
        const audioBuffer = req.body;
        console.log('Audio-Daten empfangen:', audioBuffer);
        console.log(`Audio-Datenlänge: ${audioBuffer.length} Bytes`);

        var transcription = await transcribeRecording(audioBuffer);

        res.send(transcription);
    } catch (error) {
        console.error('Fehler beim Verarbeiten des Audio-Daten:', error);
        res.status(500).send({ message: 'Fehler beim Verarbeiten der Audio-Daten.' });
    }
});

app.post('/uploadtranscript', async (req, res) => {
    try {
        const text = req.body;
        console.log('Transkript empfangen:', text);
        var summary = await summarizeTranscript(text);

        res.send(summary);
    } catch (error) {
        console.error('Fehler beim Verarbeiten der Anfrage:', error);
        res.status(500).send({ message: 'Fehler beim Verarbeiten der Anfrage.' });
    }
});


// Start Server
app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});

// ############################# Hugging Face Code ################################

// Set some constants to interact with Hugging Face Inference API
const inference = new HfInference(process.env.HF_ACCESS_TOKEN); // inference library loads access token from the .env file
const sumModel = 'knkarthick/MEETING_SUMMARY';
const speechRecogModel = 'openai/whisper-large-v3-turbo';
const keywordModel = 'transformer3/H2-keywordextractor';
const imgModel = 'black-forest-labs/FLUX.1-schnell';

async function transcribeRecording(audio) {
    try {
        var result_text = "";

        var test_text = "Good Morning everyone, shall we start our meeting? Alright, the first order of business today is designing the new remote for our flagship TV. Do you have any idea to improve upon the original design, Marcel? Yes, i think we should add new buttons with new functions. Ok, and what kind of buttons do you propose? You know, buttons to open specific apps and immediately switch to the last used app and so on, do you agree Sven? Yes, that sounds good. One idea i had is to also add speech recognition to our TV. What do you think Maxi? Oh i'm sorry i wasn't really listening. I'm thinking about the last episode of Squid Game season 2. Crazy what happened right? Sorry but now is not the time to talk about that. You're right, i'm sorry. I think Marcel's ideas are very good and pretty easily programmable. Alright then it's settled. Noam, do you have anything to talk about? Yes what should we bring to saturday's office party? I'm going to bring my famous salad, but do you need anything else? Umm, no not really. Alright then, i think we talked about everything and can end this meeting now. Goodbye everybody.";
console.log(audio);
        // ##################### Speech Recognition ####################
        // const results = await inference.automaticSpeechRecognition({
        //     model: speechRecogModel,
        //     data: audio
        // });

        console.log('Transkriptions-Ergebnisse:', test_text);

        result_text += "<b class='title-transcription-result'>Transkriptions-Ergebnisse wenn nötig korrigieren:</b><p contenteditable='true' id='transcript-text'>" + test_text + "</p><br />";

        result_text += "<div class='record-button-div'><button class='record-button'>Zusammenfassung erstellen</button></div>";

        return result_text;
    } catch (error) {
        console.error('Fehler bei der Transkription:', error);
        throw new Error('Transkription fehlgeschlagen');
    }
}

async function summarizeTranscript(text) {
    try {
        var result_text = "";

        // ##################### Summarization ####################
        const sum_results = await inference.summarization({
            model: sumModel, 
            inputs: text
        });
        
        console.log('Summarization-Ergebnisse:', sum_results.summary_text);

        var summary_arr = sum_results.summary_text.split(". ");

        var sentence_count = 0;

        // ##################### Headlines ####################
        for (var sentence of summary_arr) {
            if (sentence_count < 3) {

                const key_results = await inference.summarization({
                    model: keywordModel, 
                    inputs: sentence
                });

                var headline = key_results.summary_text.split(", ");
                headline = headline[1];
                console.log(headline);

                // ##################### Icon Creation ####################
                const image_results = await inference.textToImage({
                    model: imgModel, 
                    inputs: headline + " round app icon, no text"
                });
                
                console.log("Text-to-Image-Ergebnisse für " + headline + ": ", image_results);


                fs.writeFile('./public/temp/icons/' + headline.replaceAll(" ", "").toLowerCase() + '.png', await image_results.arrayBuffer().then((arrayBuffer) => Buffer.from(arrayBuffer, "binary")), function (err) {
                    if (err) throw err;
                    console.log('Image Created');
                }); 
            
                result_text += "<div class='elements'>"; 
                result_text += "<div class='icon-container'>";
                result_text += "<img class='icon' src='./public/temp/icons/" + headline.replaceAll(" ", "").toLowerCase() + ".png'></img>";
                result_text += "</div>"; 
                result_text += "<div class='summary-text'>";
                result_text += "<b class='headline'>" + headline + "</b><br />";
                result_text += sentence.includes(".") ? sentence + "<br />" : sentence + ".<br />";
                result_text += "</div>";
                result_text += "</div>";
            }
            else {
                result_text += "<div class='elements'>"; 
                result_text += "<div class='icon-container'>";
                result_text += "</div>"; 
                result_text += "<div class='summary-text'>";
                result_text += "<b class='headline'>" + "Andere Themen" + "</b><br />";
                result_text += sentence.includes(".") ? sentence + "<br />" : sentence + ".<br />";
                result_text += "</div>";
                result_text += "</div>";
            }
            sentence_count += 1;
        }
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.setContent(result_text);

        await page.pdf({ path: 'output.pdf', format: 'A4', printBackground: true });
        result_text += "<div class='record-button-div'><a href='output.pdf' download='Zusammenfassung'><button class='record-button'>Als PDF exportieren</button></a></div>"
        

        return result_text;
    } catch (error) {
        console.error('Fehler bei der Transkription:', error);
        throw new Error('Transkription fehlgeschlagen');
    }
}