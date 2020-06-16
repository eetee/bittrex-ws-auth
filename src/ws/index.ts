import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid'

// https://www.npmjs.com/package/signalr-client
//@ts-ignore
import signalR from 'signalr-client'

import zlib from 'zlib'
import { promisify } from 'util'
import config from '../config'
import { createHmac } from 'crypto'

type WebsocketConnection = any

class Broker extends EventEmitter {}
const broker = new Broker()

const inflateRaw = promisify(zlib.inflateRaw)

export const INCOMING_MESSAGE = 'incomingMessage'

export type SignalRClient = any

/**
 * Set up of broker
 * @returns EventEmitter to listen to
 */
export const setup = () => broker

/**
 * Send a message to the given SignalR client
 * @param client SignalRClient
 * @param message string e.g. subscription stream type
 * @param args
 */
export const send = (client: SignalRClient, message: string, args: any) =>
  call(client, message, args)

/**
 * Generate a message handler for the given client name
 * Encapsulates clientName to know how to route the query later
 * @param clientName string
 * @returns (message: any): Promise<void>
 */
const makeMessageHandler = (clientName: string) => async (message: any) => {
  console.log('raw', message)
  const data = JSON.parse(message.utf8Data)
  if (data.M) {
    //is message
    const result = await parse(clientName, data)

    if (result) {
      broker.emit(INCOMING_MESSAGE, result)
    }
  }
}

/**
 * Create a connection to the SignalR server
 * @param clientName string
 * @returns Promise<SignalRClient>
 */
export async function connect(clientName: string): Promise<SignalRClient> {
  return new Promise((resolve) => {
    console.log('Creating client for', clientName)
    const client = new signalR.client(
      config.BITTREX.SERVER,
      [config.BITTREX.HUB]
      // undefined,
      // true //don't start straight away, other examples do this
    )

    client.serviceHandlers.messageReceived = makeMessageHandler(clientName)

    client.serviceHandlers.connected = (_connection: WebsocketConnection) => {
      // console.log(_connection)
      console.log('Client ready for', clientName)
      return resolve(client)
    }
  })
}

/**
 * Authenticate the given client
 * @param client  SignalRClient
 */
export const authenticate = async (client: SignalRClient) => {
  const key = <string>process.env.BITTREX_KEY
  const secret = <string>process.env.BITTREX_SECRET
  const timestamp = new Date().getTime()
  const randomContent = uuid()
  const content = `${timestamp}${randomContent}`
  const signedContent = sign(secret, content)

  // return new Promise((resolve, reject) => {
  //   client
  //     .call(
  //       config.BITTREX.HUB,
  //       'Authenticate',
  //       key,
  //       timestamp,
  //       randomContent,
  //       signedContent
  //     )
  //     .done((err: any, data: any) => {
  //       if (err) return reject(err)
  //       return resolve(data)
  //     })
  // })

  // also tried this which will return straight away
  return client.invoke(
    'Authenticate',
    key,
    timestamp,
    randomContent,
    signedContent
  )
}

const call = async (client: SignalRClient, msg: string, ...args: any) => {
  return new Promise((resolve, reject) => {
    client
      .call(config.BITTREX.HUB, msg, ...args)
      .done((err: Error, data: any) => {
        if (err) return reject(err)
        return resolve(data)
      })
  })
}

/**
 * Signs a message for auth
 * @param secret
 * @param content
 */
export const sign = (secret: string, content: string) =>
  createHmac('sha512', secret).update(content).digest('hex').toUpperCase()

export interface IParsedMessage {
  clientName: string | undefined
  message: string
  data: any
}

/**
 * Decompresses and formats the incoming message from SignalR
 * Drawn from old v1 example here
 * https://gist.github.com/n0mad01/6a582e803ab03c517841180a1844aecf
 * @param clientName string
 * @param incoming object
 */
export const parse = async (
  clientName: string,
  incoming: any
): Promise<IParsedMessage | undefined> => {
  const b64 = incoming.M?.[0]?.A?.[0]
  if (!b64) return
  const raw = Buffer.from(b64, 'base64')

  const inflated: any = await inflateRaw(raw)
  const data = JSON.parse(inflated.toString('utf8'))

  return {
    clientName,
    message: incoming.M?.[0]?.M,
    data
  }
}
