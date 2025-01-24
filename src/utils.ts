import * as core from '@actions/core'
import axios from 'axios'
import { SearchResponse, Urls } from './types'
import fs from 'fs'
import archiver from 'archiver'
import path from 'path'

import { Browser, getInstalledBrowsers, install } from '@puppeteer/browsers'
const CACHE_DIR = '/home/runner/.cache/puppeteer'

/**
 * Prepare the Puppeteer environment by installing the necessary browser.
 * @returns {Promise<void>} Resolves when the environment is prepared.
 */
export async function preparePuppeteer(): Promise<void> {
  if (process.env.RUNNER_TEMP === undefined) {
    core.info('Running locally, skipping Puppeteer setup ...')
    return
  }

  const installed = await getInstalledBrowsers({
    cacheDir: CACHE_DIR
  })

  if (!installed.some(browser => browser.browser === Browser.CHROME)) {
    core.info('Installing Chrome ...')
    await install({
      cacheDir: CACHE_DIR,
      browser: Browser.CHROME,
      buildId: '131.0.6778.108'
    })
  }
}

export async function resolveAssetId(
  name: string,
  cookies: string
): Promise<string> {
  core.debug(`Searching asset id for ${name}...`)

  const search = await axios.get<SearchResponse>(
    `https://portal-api.cfx.re/v1/me/assets?search=${name}&sort=asset.name&direction=asc`,
    {
      headers: {
        Cookie: cookies
      }
    }
  )

  if (search.data.items.length == 0) {
    core.debug(JSON.stringify(search.data))
    throw new Error(
      `Failed to find asset id for "${name}". See debug logs for more information.`
    )
  }

  // Match the exact name
  for (const asset of search.data.items) {
    if (asset.name == name) {
      core.debug('Found asset id: ' + asset.id)
      return asset.id.toString()
    }
  }

  core.debug(JSON.stringify(search.data))
  throw new Error(
    `Failed to find asset id for "${name}" exact match. See debug logs for more information.`
  )
}

export function getUrl(type: keyof typeof Urls, id?: string): string {
  const url = Urls.API + Urls[type]
  return id ? url.replace('{id}', id) : url
}

type TreeNode = string | Record<string, TreeNode[]> | null

function buildTree(currentPath: string): TreeNode {
  const stats = fs.statSync(currentPath)

  if (stats.isFile()) {
    return path.basename(currentPath) // Return file name
  }

  if (stats.isDirectory()) {
    const children = fs.readdirSync(currentPath)
    return {
      [path.basename(currentPath)]: children.map(child =>
        buildTree(path.join(currentPath, child))
      )
    }
  }

  return null
}

export function getEnv(name: string): string {
  if (process.env[name] === undefined) {
    throw new Error(`Environment variable ${name} is not set.`)
  }

  return process.env[name]
}

export async function zipAsset(): Promise<string> {
  core.debug('Zipping asset...')

  const _path = getEnv('GITHUB_WORKSPACE')
  const output = fs.createWriteStream('cfx-portal-upload.zip')

  const archive = archiver('zip', {
    zlib: { level: 9 }
  })

  archive.pipe(output)

  core.debug('Adding files to zip...')
  archive.directory(_path, false)

  core.debug('Zip content: ' + JSON.stringify(buildTree(_path), null, 2))

  await archive.finalize()
  return path.resolve('cfx-portal-upload.zip')
}

export function deleteIfExists(_path: string): void {
  _path = path.join(getEnv('GITHUB_WORKSPACE'), _path)

  try {
    if (fs.existsSync(_path)) {
      core.debug(`Deleting ${_path}...`)
      const stats = fs.lstatSync(_path)

      if (stats.isDirectory()) {
        fs.rmSync(_path, { recursive: true, force: true })
      } else if (stats.isFile()) {
        fs.unlinkSync(_path)
      }
    } else {
      core.debug(`${_path} does not exist, skipping`)
    }
  } catch (error) {
    core.debug(`Skipping ${_path} deletion due to error: ${error as string}`)
  }
}
