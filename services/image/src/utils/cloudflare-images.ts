import { ipfsProviders } from '@kodadot1/minipfs'
import { encodeEndpoint } from '@kodadot/workers-utils'
import { CFIApiResponse } from './types'

type CFImages = {
  token: string
  imageAccount: string
}

type UploadCFI = CFImages & {
  url?: string
  file?: File
  id: string
}

async function resizeImage(url: string) {
  const wsrvnl = new URL('https://wsrv.nl')
  wsrvnl.searchParams.append('url', url)
  wsrvnl.searchParams.append('w', '1400')

  console.log(wsrvnl.toString())

  // trigger resize
  await fetch(wsrvnl.toString(), { method: 'HEAD' })

  return wsrvnl.toString()
}

export async function uploadCFI({
  token,
  url,
  id,
  imageAccount,
  file,
}: UploadCFI) {
  const uploadHeaders = new Headers()
  uploadHeaders.append('Authorization', `Bearer ${token}`)

  const uploadFormData = new FormData()

  if (url) {
    uploadFormData.append('url', url)
  }

  if (file) {
    uploadFormData.append('file', file)
  }

  uploadFormData.append('id', id)

  const requestOptions = {
    method: 'POST',
    headers: uploadHeaders,
    body: uploadFormData,
    redirect: 'follow',
  }

  const uploadCfImage = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${imageAccount}/images/v1`,
    requestOptions,
  )
  const image = (await uploadCfImage.json()) as CFIApiResponse

  console.log('uploadStatus', image.success)

  if (image.success) {
    // current variants = ['/detail', '/public', '/aaa']
    // return `https://imagedelivery.net/${imageId}/${id}/public`;
    // return image.result?.variants?.[1];
    return image.result?.variants?.find((v) => v.endsWith('/public'))
  }

  return ''
}

type DeleteCFI = CFImages & {
  id: string
}

export async function deleteCFI({ token, id, imageAccount }: DeleteCFI) {
  const uploadHeaders = new Headers()
  uploadHeaders.append('Authorization', `Bearer ${token}`)

  const requestOptions = {
    method: 'DELETE',
    headers: uploadHeaders,
  }

  const deleteCfImage = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${imageAccount}/images/v1/${id}`,
    requestOptions,
  )

  const response = (await deleteCfImage.json()) as CFIApiResponse

  return response.success
}

type IpfsToCFI = CFImages & {
  path: string
}

export async function ipfsToCFI({ token, path, imageAccount }: IpfsToCFI) {
  const imageOnIpfs = `${ipfsProviders.filebase_kodadot}/ipfs/${path}`
  const url = await resizeImage(imageOnIpfs)

  return await uploadCFI({
    token,
    url,
    id: path,
    imageAccount,
  })
}

type UrlToCFI = CFImages & {
  endpoint: string
}

export async function urlToCFI({ token, endpoint, imageAccount }: UrlToCFI) {
  const path = encodeEndpoint(endpoint)
  const url = await resizeImage(endpoint)

  return await uploadCFI({
    token,
    url,
    id: path,
    imageAccount,
  })
}

export async function getImageByPath({
  token,
  imageAccount,
  path,
}: CFImages & { path: string }) {
  const getImage = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${imageAccount}/images/v1/${path}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  )
  const image = (await getImage.json()) as CFIApiResponse
  console.log('getImageByPath', getImage.status)

  if (getImage.ok && image.result) {
    const variants = image.result.variants
    const publicURL = variants.find((url) => url.endsWith('/public'))

    if (publicURL) {
      return publicURL
    }
  }

  return ''
}

const transformationParams = [
  'w',
  'width',
  'h',
  'height',
  'anim',
  'background',
  'blur',
  'brightness',
  'fit',
  'fromat',
  'q',
  'quality',
  'sharpen',
  'trim.width',
  'trim.height',
  'trim.left',
  'trim.top',
]

export function getCFIFlexibleVariant(
  queryParams: { [param: string]: string },
  publicUrl: string,
): string {
  const transformations = Object.keys(queryParams)
    .filter((param) => transformationParams.includes(param))
    .map((param) => `${param}=${queryParams[param]}`)
    .join(',')

  if (!transformations) {
    return publicUrl
  }

  publicUrl = publicUrl.split('/public')[0]

  return `${publicUrl}/${transformations}`
}
