import { send, setup, connect, INCOMING_MESSAGE, authenticate } from './ws'

const msg = {
  client: 'local',
  auth: true,
  message: 'Subscribe',
  options: [
    // 'subaccounts_deposit',
    // 'subaccounts_order',
    'subaccounts_balance'
    // 'heartbeat'
    // 'ticker_btc-usd'
  ]
}

const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function main() {
  console.log('Starting...')

  const broker = setup()
  broker.on(INCOMING_MESSAGE, console.log)

  const client = await connect(msg.client)

  if (msg.auth) {
    console.log('beginning auth')
    // can toggle the code inside authenticate to use invoke (no callback, results in unauthorized_user)
    // or call (expects response & timesout)
    await authenticate(client)
    console.log('finished auth')
  }

  // try to sleep in case it's just call callback that's not working?
  // await sleep(10000)

  console.log('sending', msg)
  const response = await send(client, msg.message, msg.options)
  console.log('sent', response)
}

main()
