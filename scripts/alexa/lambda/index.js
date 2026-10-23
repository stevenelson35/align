// The Align Alexa skill (Alexa-hosted, Node.js): "Alexa, ask family align to add buy milk" and "…what's on today".
// It forwards what was said to Align's Google Apps Script web app (the calendar sync script), which adds the task to
// the Family Inbox or reads back today. Fill in the two settings below (see scripts/alexa/README.md).
const Alexa = require('ask-sdk-core')

// ---- Settings: the Apps Script web app URL (the same one as Align's "Refresh calendar"), and the voice secret
// (the VOICE_SECRET Script Property you created). Keep this code private (it is, in your Alexa developer console).
const WEB_APP_URL = 'PASTE_THE_APPS_SCRIPT_WEB_APP_URL_HERE'
const VOICE_SECRET = 'PASTE_THE_VOICE_SECRET_HERE'

async function align(action, text) {
  // text/plain keeps it a "simple" request; Apps Script answers POSTs with a redirect that fetch follows.
  const res = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ voice: true, secret: VOICE_SECRET, action, text }),
    redirect: 'follow',
  })
  const reply = await res.json()
  return reply.speech || (reply.ok ? 'Done.' : 'Align had a problem with that.')
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
    } catch {
      return say(h, 'Sorry, I couldn’t reach Align just now.')
    }
  },
}

const Today = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'TodayIntent',
  async handle(h) {
    try {
      return say(h, await align('today'))
    } catch {
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
