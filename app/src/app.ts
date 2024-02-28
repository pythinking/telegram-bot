import {DEV} from './secrets'
import {Bot} from './bot'

let bot: Bot | null = null;

async function initBot() {
    console.log('[Info] Initializing bot...');
    if (bot) {
        console.log('[Info] Cleaning up existing bot...');
        if(bot.alarm) {
            clearInterval(bot.alarm);
            bot.alarm = undefined;
        }
        bot = null;
    }
    bot = new Bot();
    await bot.initializeBot(DEV);
}


async function Initialize(retryCount = 0): Promise<void> {
    try {
        await initBot();
    } catch (error: any) {

        console.error('[Error]', error.toString())
    }
}



Initialize()
