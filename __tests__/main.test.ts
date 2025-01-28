/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as main from '../src/main'
import puppeteer from 'puppeteer'
import { Browser } from 'puppeteer'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
let debugMock: jest.SpiedFunction<typeof core.debug>
let infoMock: jest.SpiedFunction<typeof core.info>
let getInputMock: jest.SpiedFunction<typeof core.getInput>

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    infoMock = jest.spyOn(core, 'info').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
  })

  it('should fail if chunkSize is not a number', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'chunkSize':
          return 'invalid'
        default:
          return ''
      }
    })

    const setFailedMock = jest.spyOn(core, 'setFailed')

    await main.run()

    expect(runMock).toHaveReturned()
    expect(setFailedMock).toHaveBeenCalledWith(
      'Invalid chunk size. Must be a number.'
    )
  })

  it('should navigate to SSO URL and parse response body', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'chunkSize':
          return '1024'
        case 'makeZip':
          return 'true'
        case 'maxRetries':
          return '1'
        case 'cookie':
        case 'assetId':
        case 'assetName':
        case 'zipPath':
          return 'test-value'
        default:
          return ''
      }
    })

    const gotoMock = jest.fn()
    const evaluateMock = jest
      .fn()
      .mockResolvedValue({ url: 'https://forum.cfx.re' })
    const setCookieMock = jest.fn()

    const newPageMock = jest.fn().mockResolvedValue({
      goto: gotoMock,
      evaluate: evaluateMock,
      url: jest.fn().mockReturnValue('https://portal.cfx.re')
    })
    const browserCloseMock = jest.fn()

    jest.spyOn(puppeteer, 'launch').mockResolvedValue({
      newPage: newPageMock,
      close: browserCloseMock,
      setCookie: setCookieMock
    } as unknown as Browser)

    await main.run()

    expect(infoMock).toHaveBeenCalledWith('Navigating to SSO URL ...')

    expect(gotoMock).toHaveBeenCalledWith(
      'https://portal-api.cfx.re/v1/auth/discourse?return=',
      {
        waitUntil: 'networkidle0'
      }
    )

    expect(evaluateMock).toHaveBeenCalledTimes(2)

    expect(infoMock).toHaveBeenCalled()
    expect(infoMock).toHaveBeenCalledWith('Navigating to SSO URL ...')
    expect(infoMock).toHaveBeenCalledWith(
      'Navigated to SSO URL. Parsing response body ...'
    )
    expect(debugMock).toHaveBeenCalledWith('Parsed response body.')
    expect(infoMock).toHaveBeenCalledWith('Redirected to Forum Origin ...')
    expect(infoMock).toHaveBeenCalledWith('Setting cookies ...')
    expect(infoMock).toHaveBeenCalledWith('Redirected to Forum Origin ...')

    expect(setCookieMock).toHaveBeenCalledWith({
      name: '_t',
      value: 'test-value',
      domain: 'forum.cfx.re',
      path: '/',
      expires: -1,
      size: 1,
      httpOnly: true,
      secure: true,
      session: false
    })

    expect(gotoMock).toHaveBeenCalledWith('https://forum.cfx.re')

    expect(browserCloseMock).toHaveBeenCalled()
  })
})
