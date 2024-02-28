import * as dotenv from 'dotenv'
import * as _ from 'lodash'

dotenv.config({ path: '.env' })

// LOCAL DEVELOPMENT MODE
export const DEV: boolean = true;

export const RPC = _.defaultTo(process.env.RPC, '')

export const LOG_TOKEN = _.defaultTo(process.env.LOG_TOKEN, '')
export const LOG_CHANNEL = _.defaultTo(process.env.LOG_CHANNEL, '')

// TELEGRAM
export const TELEGRAM_ACCESS_TOKEN = _.defaultTo(process.env.TELEGRAM_ACCESS_TOKEN, '1804817901:AAFSAcWKhYeTI6L3KT7spkA_-E_jqku84yM')
export const TELEGRAM_CHANNEL = _.defaultTo(process.env.TELEGRAM_CHANNEL, '')

export const TELEGRAM_ENABLED: boolean = true;