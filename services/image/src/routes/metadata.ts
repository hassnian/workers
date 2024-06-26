import { Hono } from 'hono'
import { allowedOrigin, encodeEndpoint } from '@kodadot/workers-utils'
import { normalize, contentFrom, type BaseMetadata } from '@kodadot1/hyperdata'
import type { Env } from '../utils/constants'
import { ipfsUrl, toIpfsGw } from '../utils/ipfs'
import { cors } from 'hono/cors'

const app = new Hono<{ Bindings: Env }>()

// unable to call same workers
const toExternalGateway = (url: string) => {
  const KODA_WORKERS = 'w.kodadot.xyz/ipfs/'

  return url.includes(KODA_WORKERS) ? toIpfsGw(url) : url
}

const getMimeType = async (url: string): Promise<string> => {
  if (!url) {
    return ''
  }

  const externalUrl = toExternalGateway(url)
  const data = await fetch(externalUrl, { method: 'HEAD' })
  const contentType = data.headers.get('content-type')

  if (data.status !== 200) {
    return await getMimeType(url)
  }

  return contentType ?? ''
}

app.use('/*', cors({ origin: allowedOrigin }))

app.get('/*', async (c) => {
  const { url } = c.req.query()
  const key = 'v1.0.0-' + encodeEndpoint(url)

  // ensure ?url=url is present
  if (!url) {
    return c.text('url is required', 400)
  }

  try {
    // 0 redirect to internal url
    if (
      url.includes('fxart-beta.kodadot.workers.dev') ||
      url.includes('fxart.kodadot.workers.dev')
    ) {
      return c.redirect(url, 301)
    }

    // 1. check on KV. if exists, return the data
    // ----------------------------------------
    console.log('fetch metadata', url, key)
    const metadataKV = await c.env.METADATA.get(key)
    if (metadataKV) {
      return c.json(JSON.parse(metadataKV))
    }

    // 2. put to KV
    // ----------------------------------------
    const externalUrl = toExternalGateway(url)
    const data = await fetch(externalUrl)
    console.log('fetch metadata status', externalUrl, data.status)
    const json = (await data.json()) as BaseMetadata
    const content = contentFrom(json, true)
    // @ts-ignore
    const normalized = normalize(content, ipfsUrl)

    const imageMimeType = await getMimeType(normalized.image)
    const animationUrlMimeType = await getMimeType(normalized.animationUrl)

    const attributes = {
      imageMimeType,
      animationUrlMimeType,
      ...normalized,
    }

    // TODO: get video thumbnail once we implemented CF-Streams #186
    // https://image-beta.w.kodadot.xyz/ipfs/bafkreia3j75r474kgxxmptwh5n43j5nrvn3du5l7dcfq2twh73wmagqs6m
    // if (attributes.animationUrlMimeType.includes('video')) {}

    // cache it on KV
    c.executionCtx.waitUntil(
      c.env.METADATA.put(key, JSON.stringify(attributes)),
    )

    return c.json(attributes)
  } catch (error) {
    console.log('invalid metadata json', error)
  }

  // 3. fails, redirect to original url
  // ----------------------------------------
  return c.redirect(url)
})

export default app
