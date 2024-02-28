import RpcClient from './clients/client'
import { Context, Scenes, session, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import {InlineKeyboardButton, Update} from 'telegraf/typings/core/types/typegram'
import {TelegramClient} from './clients/telegramClient'
import {alchemyProvider} from './clients/ethersClient'
import { Markup } from 'telegraf';
import fs from 'fs'
import { ethers } from 'ethers';
import { Triggers } from 'telegraf/typings/composer';
import { textConstants } from './datatext';

import * as firebase from 'firebase/app';
import { getDatabase, ref, set  } from "firebase/database";

let registeredUsers: { [userId: number]: string } = {};
let userSettings: { [userId: number]: any } = {};  
let userWallets: { [userId: number]: any } = {};  

const firebaseConfig = {
    apiKey: "AIzaSyCTq-tAtBWB9Fc_FDwEVodFMLtjNqY6Abg",
    authDomain: "fractal-7f361.firebaseapp.com",
    databaseURL: "https://fractal-7f361-default-rtdb.firebaseio.com",
    projectId: "fractal-7f361",
    storageBucket: "fractal-7f361.appspot.com",
    messagingSenderId: "797462923110",
    appId: "1:797462923110:web:ed2933305c56315bf72aa7",
    measurementId: "G-QM94BGPWMH"  
};

const database = getDatabase(firebase.initializeApp(firebaseConfig));


export class Bot {
    telegramClient: Telegraf<Context<Update>> = TelegramClient
    rpcClient = new RpcClient(alchemyProvider)
    alarm: NodeJS.Timeout | undefined
    registeredUsers: any = []        
    stage: any
    botMode: number = 0



    async initializeBot(dev: boolean) {
        try {
            this.botMode = Number(process.env.BOT_OPERATION);

            console.log(`[Info] Initializing bot...`);                
            console.log(`[Info] Operation type: `, this.botMode);
    
            await this.SetUpTelegramTrader();

        } catch (error) {
            console.error(`[Error] An error occurred during bot initialization: ${error}`);
        }
    }

    /****************
     *  TRADER BOT  *
     ***************/

    isUserAuthenticated(userId: any) {
        return registeredUsers[userId] !== undefined;
    }

    loadRegistrationData() {
        try {
            const data = fs.readFileSync('registration_cache.json', 'utf-8');
            registeredUsers = JSON.parse(data);
            console.log('[Info] - Registration data loaded from cache file.', registeredUsers);
        } catch (error) {
            console.error('[Error] - Error loading registration data:', error);
            registeredUsers = {};
        }
    }    

    generateNewWallet() {
        const wallet = ethers.Wallet.createRandom();
        console.log('New wallet:');

        const mnemonic = wallet._mnemonic();
        const signingKey = wallet._signingKey();
        const address = wallet.address;

        const userWallet = {
            [address]: {
                mnemonic,
                signingKey
            }
        };


        console.log(userWallet)

        // Save user wallet data to file
        this.saveUserWalletDataToFile(userWallet);

        return address;
    }
    
    
    async saveUserWalletToFile(userWallet: any): Promise<void> {
        try {
            const userWalletJSON = JSON.stringify(userWallet, null, 2);
            fs.writeFileSync('user_wallets.json', userWalletJSON);
            console.log('[Info] - User wallet data saved to file.', userWallet);
        } catch (error) {
            console.error('Error saving user wallet:', error);
            throw error;
        }
    }

    async saveUserWalletDataToFile(userWallet: any): Promise<void> {
        try {
            const userWalletJSON = JSON.stringify(userWallet, null, 2);
            fs.writeFileSync('user_wallets_data.json', userWalletJSON);
            console.log('[Info] - User wallet data saved to file.', userWallet);
        } catch (error) {
            console.error('Error saving user wallet:', error);
            throw error;
        }
    }

    loadUserWallets() {
        try {
            const data = fs.readFileSync('user_wallets.json', 'utf-8');
            userWallets = JSON.parse(data);
            console.log('[Info] - Wallet data loaded from cache file:', userWallets);
        } catch (error) {
            console.log('[Error] - loading user wallets:', error);
            userWallets = {};
        }
    }    

    saveUserSettingsToFile(userSettings: any): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const userSettingsJSON = JSON.stringify(userSettings, null, 2);
                fs.writeFileSync('user_settings.json', userSettingsJSON);
                console.log('[Info] - Wallet data saved in cache file:', userWallets);
                resolve();
            } catch (error) {
                console.log('[Error] - Error saving user settings:', error);
                reject(error);
            }
        });
    }
    
    
    loadUserSettings() {
        try {
            const data = fs.readFileSync('user_settings.json', 'utf-8');
            userSettings = JSON.parse(data);
            console.log('[Info] - User settings data loaded from cache file.', userSettings);
        } catch (error) {
            console.error('Error loading registration data:', error);
            registeredUsers = {};
        }
    }

    populateDefaultUserSettings(userId: any) {
        try {
            const data = {                
                recover_wallet: false,
                show_keys: false,
                transfer_to_other_wallet: false,
                token_approvals: false,
                gas_setting: 0,
                chain_setting: '',
                slippage: 0,
                bet_amount: '10',
                future_setting: 'BTC',
                leverage: '500',
                margin_amount: '10'
            };
            const databaseRef = set(ref(database, 'settings/trader/' + userId), data);  
            
            databaseRef.then(() => {
                userSettings[userId] = data;
                console.log('Synchronization succeeded', data);

            }).catch((error) => {
                console.error('Synchronization failed:', error);
            });
            // Process the settings as needed
        } catch (error) {
            console.error('Error retrieving settings:', error);
        }

    }

    settingsMessage = async (userId: any) => {
        let userSettings = this.getUserSettings(userId);
        console.log('User settings', userSettings);

        if (!userSettings) {
            this.populateDefaultUserSettings(userId);
            userSettings = this.getUserSettings(userId); 
        }    


        console.log(userSettings)

        const betAmount = userSettings?.bet_amount || 'N/A';
        const futureSetting = userSettings?.future_setting || 'N/A';
        const leverage = userSettings?.leverage || 'N/A';
        const margin_amount = userSettings?.margin_amount || 'N/A';
        
        return `
         User Configuration:
         Omega Settings:
         - Bet Amount: ${betAmount}
         - Future Setting: ${futureSetting}
         Apollo Settings:
         - Leverage: ${leverage}
         - Margin Amount: ${margin_amount}
         Select Below To Modify:
         `;
    };
    
    getUserSettings(userId: any) {
        return userSettings[userId];
    }
    
    async SetUpTelegramTrader() {

        this.loadRegistrationData()
        this.loadUserWallets()
        this.loadUserSettings()
        
        this.telegramClient = TelegramClient 
            
            this.stage = new Scenes.Stage();
            const settingsScene = new Scenes.BaseScene("settings");
            const walletScene = new Scenes.BaseScene("wallets");            
            const defaultWalletScene = new Scenes.BaseScene("defaultWalletScene");
            
            this.registerScenes(settingsScene, walletScene, defaultWalletScene);

            this.telegramClient.use(session());
            this.telegramClient.use(this.stage.middleware());

            this.registerActions();
    
            this.telegramClient.start(async (ctx) => {
                this.startConversation(ctx);
            });
    
            this.telegramClient.action('Registration', async (ctx) => {
                this.registerUser(ctx);
            });
    
            this.telegramClient.action('Close', async (ctx) => {
                await ctx.reply('Goodbye!');
            });

            this.telegramClient.action('Back', async (ctx) => {
                this.mainMenu(ctx)          
            });              
    
            this.telegramClient.action('Settings', async (ctx) => {
                this.settingsMenu(ctx);
            });
    
            const settingsActions = [                         
                'bet_amount', 'future_setting', 'leverage', 'margin_amount', 'back',
            ];
           
            for (const action of settingsActions) {
                this.telegramClient.action(action, async (ctx) => {                    
                    this.modifySettings(ctx, action);
                });
            }

            this.telegramClient.action('Wallets', async (ctx) => {
                this.walletSettings(ctx);
            });
            
            this.telegramClient.action('add_wallet', async (ctx) => {
                this.addWallet(ctx)
            });

            this.telegramClient.action('add_transfer_wallet', async (ctx) => {
                this.addTransferWallet(ctx)
            });

            this.telegramClient.action('delete_wallet', async (ctx) => {
                this.deleteWallet(ctx)
            });

            this.telegramClient.action(/delete_wallet_continue:(.+)/, (ctx: any) => {
                this.deleteWalletContinue(ctx)
            });              

            this.telegramClient.action(/delete_wallet_transfer_continue:(.+)/, (ctx: any) => {
                this.deleteWalletTransferContinue(ctx)
            });              

            this.telegramClient.action(/default_wallet_continue:(.+)/, (ctx: any) => {
                this.defaultWalletTransferContinue(ctx)
            });            

            this.telegramClient.action('default_wallet', async (ctx) => {
                this.defaultWallet(ctx)
            });

            this.telegramClient.action('disable_default_wallets', async (ctx) => {
                this.defaultUseTotalWallets(ctx)
            });

            this.telegramClient.action('use_one_wallet', async (ctx) => {
                this.defaultUseTotalWallets(ctx, 1)
            });

            this.telegramClient.action('use_two_wallets', async (ctx) => {
                this.defaultUseTotalWallets(ctx, 2)
            });                                                     

            this.telegramClient.action('disable_manual_wallets', async (ctx) => {
                this.defaultManualTotalWallets(ctx)
            });

            this.telegramClient.action('use_one_wallet_manual', async (ctx) => {
                this.defaultManualTotalWallets(ctx, 1)
            });

            this.telegramClient.action('use_two_wallets_manual', async (ctx) => {
                this.defaultManualTotalWallets(ctx, 2)
            });
    
            this.telegramClient.launch();
    }

    registerScenes(...scenes: Scenes.BaseScene<Context<Update>>[]) {
        scenes.forEach(scene => this.stage.register(scene));
    }

    registerActions() {
        this.registerAction("add_wallet", this.addWallet);
        this.registerAction("add_transfer_wallet", this.addTransferWallet);
        this.registerAction("delete_wallet", this.deleteWallet);
        this.registerAction("default_wallet", this.defaultWallet);
        this.registerAction("default_wallet_auto", this.defaultWalletAuto);
        this.registerAction("default_wallet_manual", this.defaultWalletManual);
    }

    registerAction(actionName: Triggers<Context<Update>>, actionFunction: { (ctx: any): Promise<void>; (ctx: any): Promise<void>; (ctx: any): Promise<void>; (ctx: any): Promise<void>; (ctx: any): Promise<void>; call?: any; }) {
        this.telegramClient.action(actionName, async ctx => {
            await actionFunction.call(this, ctx);
        });
    }
                        
    async startConversation(ctx: any){

        const userId = ctx.from.id;

        if (!this.isUserAuthenticated(userId))
            this.registrationMenu(ctx)
        else
            this.mainMenu(ctx)          
    }

    async mainMenu(ctx: any){

        await ctx.reply(textConstants.textWelcome,
            
            Markup.inlineKeyboard([ 
                [                
                    Markup.button.callback('🌟 Omega', 'Omega'),
                    Markup.button.callback('🚀 Apollo', 'Apollo')
                ],
                [
                    Markup.button.callback('💼 Wallets', 'Wallets'),
                    Markup.button.callback('🔧 Settings', 'Settings')
                ]                
            ])
        );
    }

    async registrationMenu(ctx: any){

        await ctx.reply(textConstants.textWelcome,
            Markup.inlineKeyboard([
                Markup.button.callback('🔫 Register', 'Registration'),
                Markup.button.callback('❌ Close', 'Close')
            ])
        );
    }
    
    async settingsMenu(ctx: any) {
        const userId = ctx.from.id;

        if (!this.isUserAuthenticated(userId)) {
            await ctx.reply('You are not registered. Please register first.');
            return;
        }

        const message = await this.settingsMessage(userId);
            
        await ctx.reply(message,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('🔧 Bet Amount', 'bet_amount'),
                    Markup.button.callback('🔧 Future Setting', 'future_setting')
                ],
                [
                    Markup.button.callback('🔧 Leverage', 'leverage'),
                    Markup.button.callback('🔧 Margin Amount', 'margin_amount')
                ],                        
                [
                    Markup.button.callback('⬅️ Back', 'Back'),
                    Markup.button.callback('❌ Close', 'Close'),                    
                ]
            ])
        );
    
    }

    
    getTitleForAction(action: string): string {
        switch (action) {
            case 'bet_amount':
                return textConstants.textBetAmount;
            case 'future_setting':
                return textConstants.textFutureTrading;     
            case 'leverage':
                return textConstants.textLeverage;
            case 'margin_amount':
                return textConstants.textMarginAmount;      
            default:
                return 'Default Title';
        }
    }
    
    getReplyForAction(action: string, amount: number = 0): string {        
        
        switch (action) {
            case 'bet_amount':
                return `Bet amount has been set to ${amount}.`;
            case 'future_setting':
                return `Future setting  has been set to ${amount}.`;
            case 'leverage':
                return `Leverage has been set to ${amount}.`;
            case 'margin_amount':
                return `Margin amount  has been set to ${amount}.`;
            default:
                return action;        
        }
    }
    

     /****************
     **  ACTIONS ******
     ***************/
    
    async registerUser(ctx: any) {
        const userId = ctx.from.id;
        const token = Math.random().toString(36).substr(2, 10);
        registeredUsers[userId] = token;
    
        try {
            const registrationData = JSON.stringify(registeredUsers);
            this.populateDefaultUserSettings(userId)
            
            fs.writeFileSync('registration_cache.json', registrationData);
            console.log('Registration data saved to cache file.');
        } catch (error) {
            console.error('Error saving registration data:', error);
        }
    
        await ctx.reply(`Registration successful! Your token: ${token}`);
        this.mainMenu(ctx);
    }

   
    async modifySettings(ctx: any, action: any) {
        const userId = ctx.from.id;

        if (!userId || !registeredUsers[userId]) {
            console.log('User not registered');
            await ctx.reply('You are not registered. Please register first.');
            return;
        }

        console.log('Action:', action);

        if (action === 'wallets')
            this.walletSettings(ctx)        
        else 
            this.changeConfig(ctx, action)            
    }

    async changeConfig(ctx: any, action: any){

        const title = this.getTitleForAction(action);
        
        await ctx.reply(title);
        await ctx.reply('Please enter the new value:');
        const userId = ctx.from.id;

        const settingsScene = new Scenes.BaseScene("settings");
        
        settingsScene.on("text", async (sceneCtx) => {
            const amount = parseFloat(sceneCtx.message.text);

            if (isNaN(amount)) {
                await sceneCtx.reply('Invalid input. Please enter a valid number.');
                return;
            }

            if (!userSettings[userId]) {
                userSettings[userId] = {};
            }

            userSettings[userId] = {
                ...userSettings[userId],
                [action]: amount,
            };

            console.log(userSettings[userId])

            await this.saveUserSettingsToFile(userSettings);

            const reply = this.getReplyForAction(action, amount);

            await sceneCtx.reply(`${reply}`);
            await ctx.scene.leave("settings");

            this.settingsMenu(ctx);
        });

        this.stage.register(settingsScene);

        await ctx.scene.enter("settings");
    }


    async walletSettings(ctx: any) {
        const userId = ctx.from.id;
    
        const existingWallets = userWallets[userId]?.wallets || [];
        const transferWallets = userWallets[userId]?.transferWallets || [];
    
        let walletInfo = `Wallets Settings\n\n` +
            `Default Wallet: ${userWallets[userId]?.defaultWallet || 'Not Set'}\n` +
            `Default Auto Wallets: ${userWallets[userId]?.default_auto_wallets || 'Not Set'}\n` +
            `Default Manual Wallets: ${userWallets[userId]?.default_manual_wallets || 'Not Set'}\n\n` +
            `Existing Wallet(s):\n`;
    
        existingWallets.forEach((wallet: any, index: number) => {
            walletInfo += `${index + 1} - ${wallet}\n      0 ETH\n`; 
        });
    
        walletInfo += `\nTransfer Wallet(s) (${transferWallets.length} / 5):\n\n`
        
        transferWallets.forEach((wallet: any, index: number) => {
            walletInfo += `${index + 1} - ${wallet}\n      0 ETH\n`; 
        });
        
        walletInfo +=`You Can Add Up To ${3 - existingWallets.length} More Wallets!\n` + 
            `You Can Add Up To ${5 - transferWallets.length} More Transfer Wallets!\n\n`            
    
        await ctx.replyWithMarkdown(walletInfo);

        await ctx.reply('Select an option:', Markup.inlineKeyboard([
            [
                Markup.button.callback('🔧 Add Wallet', 'add_wallet'),
                Markup.button.callback('🔧 Add Transfer Wallet', 'add_transfer_wallet'),
            ],
            [
                Markup.button.callback('🔧 Delete Wallet', 'delete_wallet'),
                Markup.button.callback('🔧 Default Wallet', 'default_wallet'),
            ],
            [
                Markup.button.callback('🔧 Default Wallet(s) Auto', 'default_wallet_auto'),
                Markup.button.callback('🔧 Default Wallet(s) Manual', 'default_wallet_manual'),
            ],
            [
                Markup.button.callback('⬅️ Back', 'Back'),
                Markup.button.callback('❌ Close', 'Close')
            ]                                
        ]));
    }
    
    
    initUserWallets(userId: number) {
        if (!userWallets[userId]) {
            userWallets[userId] = {
                wallets: [],
                transferWallets: []
            };
        }
    }

    async addWallet(ctx: any) {
        const userId = ctx.from.id;
        this.initUserWallets(userId);

        const existingWallets = userWallets[userId].wallets || [];
        const transferWallets = userWallets[userId].transferWallets || [];

        if (existingWallets.length >= 3 || transferWallets.length >= 5) {
            await ctx.reply("You've reached the maximum number of allowed wallets.");
            return;
        }

        const newWallet = this.generateNewWallet();
        existingWallets.push(newWallet);
        userWallets[userId].wallets = existingWallets;
        await this.saveUserWalletToFile(userWallets);
        await ctx.reply(`New wallet added:\n${newWallet}`);
        await this.walletSettings(ctx);
    }

    
    async addTransferWallet(ctx: any) {
        const userId = ctx.from.id;
        this.initUserWallets(userId);

        const existingWallets = userWallets[userId].wallets || [];
        const transferWallets = userWallets[userId].transferWallets || [];

        if (transferWallets.length >= 5 || existingWallets.length >= 3) {
            await ctx.reply("You've reached the maximum number of allowed transfer wallets.\n\n");
            return;
        }

        const newWallet = this.generateNewWallet();
        transferWallets.push(newWallet);

        userWallets[userId].transferWallets = transferWallets;

        await this.saveUserWalletToFile(userWallets);
        await ctx.reply(`New transfer wallet added:\n${newWallet}`);
        await this.walletSettings(ctx);
    }

    
    async defaultWallet(ctx: any) {
        try {
            const userId = ctx.from.id;
    
            if (!userWallets[userId]) {
                userWallets[userId] = {};
            }

            const walletOptions = [];
            const walletOptionsButtons: (InlineKeyboardButton & { hide?: boolean | undefined; })[][] = [];
    
            if (userWallets[userId]?.wallets && userWallets[userId]?.wallets.length > 0) {
                userWallets[userId].wallets.forEach((wallet: any, index: number) => {
                    const walletText = `${index + 1} - ${wallet}`;
                    walletOptions.push(walletText);
    
                    const callback = `default_wallet_continue:${index}`;
                    walletOptionsButtons.push([
                        Markup.button.callback(`${walletText}`, callback)
                    ]);
                });
            }
                 
            if (walletOptions.length === 0) {
                await ctx.reply("You don't have any wallets to set as default.");
                return;
            }
    
            const walletPrompt = `Select the wallet to set as default:\n`;
            await ctx.reply(walletPrompt, Markup.inlineKeyboard(walletOptionsButtons));
        } catch (error) {
            console.error('Error in defaultWallet:', error);
            await ctx.reply('An error occurred while processing your request. Please try again later.');
        }
    }
    
    
    async defaultWalletAuto(ctx: any) {
        try {
    
            await ctx.reply('Select an option:', Markup.inlineKeyboard([
                [
                    Markup.button.callback('🔧 Disable Default Wallets', 'disable_default_wallets'),                    
                ],                
                [                    
                    Markup.button.callback('🔧 Use 1 Wallet', 'use_one_wallet'),                    
                ],                
                [                    
                    Markup.button.callback('🔧 Use 2 Wallets', 'use_two_wallets'),
                ],                
                [
                    Markup.button.callback('⬅️ Back', 'Back'),
                    Markup.button.callback('❌ Close', 'Close')
                ]                                
            ]));

        } catch (error) {
            console.error('Error in defaultWalletAuto:', error);
            await ctx.reply('An error occurred while processing your request. Please try again later.');
        }
    }


    
    async defaultUseTotalWallets(ctx: any, total: number = 0){
        const userId = ctx.from.id;

        userWallets[userId].default_auto_wallets = total
            
        const msg = `Default Auto Wallet ${userWallets[userId].default_auto_wallets} has been set to ${total}`
        console.log(`[Info] Default Wallet ${userWallets[userId].default_auto_wallets} has been set to ${total}.`)

        await this.saveUserWalletToFile(userWallets);
        
        await ctx.reply(msg);
        this.walletSettings(ctx)
    }

    async defaultManualTotalWallets(ctx: any, total: number = 0){
        const userId = ctx.from.id;

        userWallets[userId].default_manual_wallets = total
            
        const msg = `Default Manual Wallet ${userWallets[userId].default_manual_wallets} has been set to ${total}`
        console.log(`[Info] Default Manual Wallet ${userWallets[userId].default_manual_wallets} has been set to ${total}.`)

        await this.saveUserWalletToFile(userWallets);
        
        await ctx.reply(msg);
        this.walletSettings(ctx)
    }

    
    async deleteWallet(ctx: any) {
        try {
            const userId = ctx.from.id;
    
            if (!userWallets[userId]) {
                userWallets[userId] = {};
            }

            const walletOptions = [];
            const walletOptionsButtons: (InlineKeyboardButton & { hide?: boolean | undefined; })[][] = [];
    
            if (userWallets[userId]?.wallets && userWallets[userId]?.wallets.length > 0) {
                userWallets[userId].wallets.forEach((wallet: any, index: number) => {
                    const walletText = `${index + 1} - ${wallet}`;
                    walletOptions.push(walletText);
    
                    const callback = `delete_wallet_continue:${index}`;
                    walletOptionsButtons.push([
                        Markup.button.callback(`Existing Wallet(s): ${walletText}`, callback)
                    ]);
                });
            }
    
            if (Array.isArray(userWallets[userId]?.transferWallets) && userWallets[userId]?.transferWallets.length > 0) {
                userWallets[userId].transferWallets.forEach((wallet: any, index: number) => {
                    const walletText = `${index + 1} - ${wallet}`;
                    walletOptions.push(walletText);
    
                    const callback = `delete_wallet_transfer_continue:${index}`;
                    walletOptionsButtons.push([
                        Markup.button.callback(`Transfer Wallet(s): ${walletText}`, callback)
                    ]);
                });
            }
    
            if (walletOptions.length === 0) {
                await ctx.reply("You don't have any wallets to delete.");
                return;
            }
    
            const walletPrompt = `Select the wallet to delete:\n`;
            await ctx.reply(walletPrompt, Markup.inlineKeyboard(walletOptionsButtons));
        } catch (error) {
            console.error('Error in deleteWallet:', error);
            await ctx.reply('An error occurred while processing your request. Please try again later.');
        }
    }
    
        
    async deleteWalletContinue(ctx: any){

        const userId = ctx.from.id;
        const index = parseInt(ctx.match[1]); 

        if (userWallets[userId]?.wallets && userWallets[userId].wallets[index]) {
            
            const wallet = userWallets[userId].wallets[index]
            userWallets[userId].wallets.splice(index, 1);
            
            const msg = `Wallet ${wallet} has been deleted.`
            console.log(`[Info] Wallet ${wallet} has been deleted`)
            
            await ctx.reply(msg);
            this.walletSettings(ctx)
        }
    }

    async deleteWalletTransferContinue(ctx: any){

        const userId = ctx.from.id;
        const index = parseInt(ctx.match[1]); 

        if (userWallets[userId]?.transferWallets && userWallets[userId].transferWallets[index]) {
            
            const wallet = userWallets[userId].transferWallets[index]
            userWallets[userId].transferWallets.splice(index, 1);
            
            const msg = `Transfer Wallet ${wallet} has been deleted.`
            console.log(`[Info] Transfer Wallet ${wallet} has been deleted`)

            await this.saveUserWalletToFile(userWallets);
            
            await ctx.reply(msg);
            this.walletSettings(ctx)
        }
    }
    

    async defaultWalletTransferContinue(ctx: any){
        const userId = ctx.from.id;
        const index = parseInt(ctx.match[1]); 

        if (userWallets[userId]?.wallets && userWallets[userId].wallets[index]) {
        
            userWallets[userId].defaultWallet = userWallets[userId].wallets[index]
            
            const msg = `Default Wallet ${userWallets[userId].defaultWallet} has been set`
            console.log(`[Info] Default Wallet ${userWallets[userId].defaultWallet} has been set.`)

            await this.saveUserWalletToFile(userWallets);
            
            await ctx.reply(msg);
            this.walletSettings(ctx)
        }
    }
   
    
    
    async defaultWalletManual(ctx: any) {
        try {
    
            await ctx.reply('Select an option:', Markup.inlineKeyboard([
                [
                    Markup.button.callback('🔧 Disable Manual Wallets', 'disable_manual_wallets'),                    
                ],                
                [                    
                    Markup.button.callback('🔧 Use 1 Wallet', 'use_one_wallet_manual'),                    
                ],                
                [                    
                    Markup.button.callback('🔧 Use 2 Wallets', 'use_two_wallets_manual'),
                ],                
                [
                    Markup.button.callback('⬅️ Back', 'Back'),
                    Markup.button.callback('❌ Close', 'Close')
                ]                                
            ]));

        } catch (error) {
            console.error('Error in defaultWalletAuto:', error);
            await ctx.reply('An error occurred while processing your request. Please try again later.');
        }
    }
                    
}


