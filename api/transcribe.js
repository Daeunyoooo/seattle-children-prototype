import { transcribeRequest } from "../server/transcribe.js";

export default async function handler(req, res) {
  await transcribeRequest(req, res);
}
