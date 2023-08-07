import { ComponentSettings, Manager, MCEvent } from '@managed-components/types'
import UAParser from 'ua-parser-js'

export const eventHandler = async (
  eventType: string,
  manager: Manager,
  event: MCEvent,
  settings: ComponentSettings
) => {
  const { payload, client } = event

  const endpoint = 'https://api.persio.io/v1/' + eventType
  const { writeKey } = settings

  // Prepare new payload
  const uaParser = new UAParser(client.userAgent).getResult()
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  const persioPayload: any = {
    ...(payload.event && { event: payload.event }),
    callType: eventType,
    anonymousId: payload.anonymousId,
    userId: payload.userId,
    context: {
      ip: client.ip,
      locale: client.language,
      page: {
        url: client.url.href,
        title: client.title,
        referrer: client.referer,
        path: client.url.pathname,
        search: client.url.search,
      },
      screen: {
        width: client.screenWidth,
        height: client.screenHeight,
      },
      os: { name: uaParser.os.name },
      userAgent: uaParser.ua,
    },
  }

  if (eventType === 'identify' || eventType === 'group') {
    persioPayload.traits = payload
  } else {
    persioPayload.properties = payload
  }

  if (eventType === 'page') {
    persioPayload.properties = {
      ...persioPayload.properties,
      ...persioPayload.context.page,
    }
  }

  // If we don't have anonymousId, try to get it from the cookie
  if (!persioPayload.anonymousId && client.get('ajs_anonymous_id')) {
    persioPayload.anonymousId = client.get('ajs_anonymous_id')
  }

  // If both userid and anonymousId are missing, generate one
  if (!persioPayload.userId && !persioPayload.anonymousId) {
    const anonId = crypto.randomUUID()
    persioPayload.anonymousId = anonId
    client.set('ajs_anonymous_id', anonId, {
      scope: 'infinite',
    })
  }

  const encodeBase64 = (data: any) => {
    return Buffer.from(data).toString('base64')
  }

  // Send the request
  const headers = {
    Authorization: `Basic ${encodeBase64(writeKey)}`,
    'Content-Type': 'application/json',
  }

  manager.fetch(endpoint, {
    headers,
    method: 'POST',
    body: JSON.stringify(persioPayload),
  })
}

export default async function (manager: Manager, settings: ComponentSettings) {
  manager.addEventListener('pageview', event => {
    eventHandler('page', manager, event, settings)
  })
  manager.addEventListener('track', event => {
    eventHandler('track', manager, event, settings)
  })
  manager.addEventListener('identify', event => {
    eventHandler('identify', manager, event, settings)
  })
  manager.addEventListener('alias', event => {
    eventHandler('alias', manager, event, settings)
  })
  manager.addEventListener('group', event => {
    eventHandler('group', manager, event, settings)
  })
}
