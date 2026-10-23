// The Align Alexa skill (Alexa-hosted, Node.js): "Alexa, ask family align to add buy milk" and "…what's on today".
// It forwards what was said to Align's Google Apps Script web app (the calendar sync script), which adds the task to
// the Family Inbox or reads back today. Fill in the two settings below (see scripts/alexa/README.md).
const Alexa = require('ask-sdk-core')

// ---- Settings: the Apps Script web app URL (the same one as Align's "Refresh calendar"), and the voice secret
// (the VOICE_SECRET Script Property you created). Keep this code private (it is, in your Alexa developer console).
const WEB_APP_URL = 'PASTE_THE_APPS_SCRIPT_WEB_APP_URL_HERE'
const VOICE_SECRET = 'PASTE_THE_VOICE_SECRET_HERE'

// POSTs with Node's https module (works on every Alexa-hosted Node version, unlike fetch). Apps Script answers a POST
// with a redirect to the result, which is then fetched with GET.
function request(url, body, hops = 0) {
  const https = require('https')
  return new Promise((resolve, reject) => {
    const req = https.request(url, body ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Content-Length': Buffer.byteLength(body) } } : { method: 'GET' }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 5) {
        res.resume()
        return resolve(request(new URL(res.headers.location, url).toString(), null, hops + 1))
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, data }))
    })
    req.on('error', reject)
    req.setTimeout(7000, () => req.destroy(new Error('timed out')))
    if (body) req.write(body)
    req.end()
  })
}

async function align(action, text) {
  if (WEB_APP_URL.startsWith('PASTE') || VOICE_SECRET.startsWith('PASTE')) throw new Error('WEB_APP_URL / VOICE_SECRET not filled in')
  const { status, data } = await request(WEB_APP_URL.trim(), JSON.stringify({ voice: true, secret: VOICE_SECRET.trim(), action, text }))
  let reply
  try {
    reply = JSON.parse(data)
  } catch {
    throw new Error(`HTTP ${status}, not JSON: ${data.slice(0, 200)}`)
  }
  return reply.speech || (reply.ok ? 'Done.' : `Align had a problem with that: ${reply.error || 'unknown error'}.`)
}

const say = (h, speech, reprompt) => {
  const r = h.responseBuilder.speak(speech)
  return (reprompt ? r.reprompt(reprompt) : r.withShouldEndSession(true)).getResponse()
}

const Launch = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  handle: (h) => say(h, 'Align is ready. Say add, then a task, like add buy milk. Or ask what’s on today.', 'What should I add?'),
}

const AddTask = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AddTaskIntent',
  async handle(h) {
    const task = Alexa.getSlotValue(h.requestEnvelope, 'task')
    if (!task) return say(h, 'What should I add?', 'What should I add?')
    try {
      return say(h, await align('add', task))
    } catch (err) {
      console.log('Align request failed:', err)
      return say(h, 'Sorry, I couldn’t reach Align just now.')
    }
  },
}

const Today = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'TodayIntent',
  async handle(h) {
    try {
      return say(h, await align('today'))
    } catch (err) {
      console.log('Align request failed:', err)
      return say(h, 'Sorry, I couldn’t reach Align just now.')
    }
  },
}

const Help = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && ['AMAZON.HelpIntent', 'AMAZON.FallbackIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),
  handle: (h) => say(h, 'You can say: add buy milk, remind us to call the vet, or what’s on today.', 'What would you like?'),
}

const Stop = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    ['AMAZON.CancelIntent', 'AMAZON.StopIntent', 'AMAZON.NavigateHomeIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),
  handle: (h) => say(h, 'Okay.'),
}

const Ended = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
  handle: (h) => h.responseBuilder.getResponse(),
}

const Errors = {
  canHandle: () => true,
  handle: (h) => say(h, 'Sorry, something went wrong.'),
}

exports.handler = Alexa.SkillBuilders.custom().addRequestHandlers(Launch, AddTask, Today, Help, Stop, Ended).addErrorHandlers(Errors).lambda()
