import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function run() {
  try {
    const models = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY);
    const data = await models.json();
    console.log("AVAILABLE MODELS:", data.models?.map(m => m.name).join(', '));
  } catch (e) {
    console.error("Error", e);
  }
}

run();
