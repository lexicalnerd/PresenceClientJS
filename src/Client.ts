import net from 'net'
import https from 'https'
import RPC from 'discord-rpc'
import { Logger } from './util/Logger'
import BinaryStream from './util/BinaryStream'
import chalk from 'chalk'

export class Client {
  private rpcClient = new RPC.Client({ transport: 'ipc' })
  private socketClient: net.Socket
  private logger = new Logger()
  private clientId = '831528990439243806'
  private currentProgramId: bigint
  private currentGameName: string = ''
  private currentTimestamp: number | null = null
  private pingTimeout: NodeJS.Timeout | null = null
  private activityInterval: NodeJS.Timeout | null = null

  private programIdMap: Record<string, string> = {
    '05003A400C3DA000': '01003A400C3DA000',
  }

  private customImageMap: Record<string, string> = {
    'Switchfin': 'https://raw.githubusercontent.com/dragonflylee/switchfin/refs/heads/dev/resources/icon/icon.jpg',
    'nx-hbmenu': 'https://raw.githubusercontent.com/switchbrew/nx-hbmenu/refs/heads/master/icon.jpg',
    'Homebrew Menu': 'https://raw.githubusercontent.com/switchbrew/nx-hbmenu/refs/heads/master/icon.jpg',
    'RetroArch': 'https://gbatemp.net/attachments/retroarch-jpg.266593/'
  }

  constructor(private host: string, private port: number) {}

  public async init() {
    await this.connectToDiscord()
    this.initListeners()
    this.startSocket()
    this.startActivityInterval()
    return this
  }

  private fixProgramId(hexId: string): string {
    return this.programIdMap[hexId] ?? hexId
  }

  private getActivityType(gameName: string): number {
    const watchingApps = ['YouTube', 'Switchfin', 'Crunchyroll']
    return watchingApps.some(app => gameName.toLowerCase().includes(app.toLowerCase())) ? 3 : 0
  }

  private getCustomImage(gameName: string): string | null {
    const match = Object.keys(this.customImageMap).find(key =>
      gameName.toLowerCase().includes(key.toLowerCase())
    )
    return match ? this.customImageMap[match] : null
  }

  private async getImageKey(hexId: string): Promise<string> {
    const url = `https://tinfoil.media/ti/${hexId}/256/256/`
    return new Promise(resolve => {
      const req = https.request(url, { method: 'HEAD' }, res => {
        if (res.statusCode === 200) {
          resolve(url)
        } else {
          this.logger.log(`No image found for ${hexId}, using default.`)
          resolve('nintendo_switch_default')
        }
      })
      req.on('error', () => {
        this.logger.log(`Image check failed for ${hexId}, using default.`)
        resolve('nintendo_switch_default')
      })
      req.end()
    })
  }

  public async setActivity(gameName: string, programId: bigint, timestamp?: number) {
    if (programId === 0x0100000000001000n) {
      await this.rpcClient.clearActivity()
      return
    }

    const hexId = programId.toString(16).toUpperCase().padStart(16, '0')
    const fixedHexId = this.fixProgramId(hexId)
    this.logger.log(`Image URL: https://tinfoil.media/ti/${fixedHexId}/256/256/`)
    const imageKey = this.getCustomImage(gameName) ?? await this.getImageKey(fixedHexId)

    const transport = (this.rpcClient as any).transport
    const nonce = Date.now().toString()

    transport.send({
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: {
          type: this.getActivityType(gameName),
          name: gameName,
          state: 'on Nintendo Switch',
          timestamps: timestamp ? { start: timestamp } : undefined,
          assets: {
            large_image: imageKey,
            large_text: gameName
          }
        }
      },
      nonce
    })
  }

  private startActivityInterval() {
    if (this.activityInterval) clearInterval(this.activityInterval)
    this.activityInterval = setInterval(() => {
      if (this.currentProgramId) {
        this.setActivity(this.currentGameName, this.currentProgramId, this.currentTimestamp)
      }
    }, 15000)
  }

  private initListeners() {
    this.socketClient = new net.Socket()

    this.rpcClient.on('ready', () => {
      this.logger.log('Successfully connected to Discord.')
    })

    this.socketClient.on('connect', () => {
      this.logger.log('Successfully connected to Nintendo Switch console.')
    })

    this.socketClient.on('data', data => this.handleData(data))
    this.socketClient.on('error', err => this.handleSocketError(err))
  }

  private handleData(message: Buffer) {
    clearTimeout(this.pingTimeout)
    const stream = new BinaryStream(message)
    stream.readULong() // Magic
    let programId = stream.readULong()
    let name = stream.readString(612).split('\0')[0]

    if (programId === 0n) {
      programId = 0x0100000000001000n
      name = 'Home Menu'
    }

    if (programId != this.currentProgramId) {
      this.currentProgramId = programId
      this.currentGameName = name
      this.currentTimestamp = programId === 0x0100000000001000n ? null : Date.now()
      this.setActivity(name, programId, this.currentTimestamp)
      this.logger.log`Program ID for ${chalk.yellow(name)} is ${chalk.yellow(programId.toString(16))}`
    }

    this.pingTimeout = setTimeout(() => {
      this.logger.log('Not received data in 10 seconds, reconnecting...')
      this.startSocket()
    }, 10000)
  }

  private handleSocketError(err: any) {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout)
      this.pingTimeout = null
    }

    switch (err.code) {
      case 'ETIMEDOUT':
      case 'ECONNREFUSED':
        this.logger.log(chalk.yellow('Could not connect to Nintendo Switch console. Retrying in 5 seconds...'))
        setTimeout(() => this.startSocket(), 5000)
        break
      case 'ECONNRESET':
        this.logger.log(chalk.yellow('Connection to Switch lost. Retrying in 5 seconds...'))
        setTimeout(() => this.startSocket(), 5000)
        break
      default:
        this.logger.log('An unknown error has occured. Please make a new issue at https://github.com/DelxHQ/ClientSwitchPresence/issues with a screenshot of the terminal.')
        console.error(err)
        this.rpcClient.destroy()
        this.socketClient.destroy()
        process.exit()
    }
  }

  private startSocket() {
    if (this.socketClient) {
      this.socketClient.removeAllListeners()
      this.socketClient.destroy()
    }

    this.logger.log('Connecting to Switch...')
    this.socketClient = new net.Socket()

    this.socketClient.on('connect', () => {
      this.logger.log('Successfully connected to Nintendo Switch console.')
    })
    this.socketClient.on('data', data => this.handleData(data))
    this.socketClient.on('error', err => this.handleSocketError(err))

    this.socketClient.connect(this.port, this.host)
  }

  private async connectToDiscord(maxRetries = 10, delay = 3000) {
    this.logger.log('Connecting to Discord...')

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.rpcClient.login({ clientId: this.clientId })
        return
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.log(chalk.red('Failed to connect to Discord after multiple attempts.'))
          this.logger.log(chalk.yellow('Please make sure:'))
          this.logger.log(chalk.yellow('  1. Discord desktop app is running (not web version)'))
          this.logger.log(chalk.yellow('  2. "Display current activity" is enabled in Discord settings'))
          this.logger.log(chalk.yellow('  3. Discord is not blocked by firewall'))
          throw new Error('Could not connect to Discord')
        }

        this.logger.log(chalk.yellow(`Discord connection attempt ${attempt}/${maxRetries} failed. Retrying in ${delay/1000}s...`))
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  public async destroy() {
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    if (this.activityInterval) clearInterval(this.activityInterval)
    await this.rpcClient.destroy()
    this.socketClient.destroy()
  }
}
