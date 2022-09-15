const {Scenes, Markup} = require("telegraf")

class SceneGenerator {
    #_PgPool = null;
    constructor(db) {
        this.#_PgPool = db;
    }
    #mailingPoolScene = {
        sending: async function (ctx) {
            //console.log(ctx);
            await ctx.scene.enter("sender");
        },
        cancel: async function (ctx) {
            //console.log(ctx);
            await ctx.reply("Отмена рассылки")
            await ctx.scene.leave()
        }
    }
    CreateMailingPoolScene() {
        const mailing = new Scenes.BaseScene('mailing')

        mailing.enter(  async (ctx) => {
            await ctx.reply("Вы выбрали рассылку всем пользователям. Вы уверены, что хотите это сделать?", Markup.inlineKeyboard([
                Markup.button.callback('Уверен', "Уверен"),
                Markup.button.callback('Отмена', "Отмена")
            ]))
        })
        // mailing.leave(async ctx=>{
        //     await ctx.reply("Отмена рассылки")
        // })
        mailing.action("Уверен",  async (ctx)=>{
              await this.#mailingPoolScene.sending(ctx)
        })
        mailing.action("Отмена", async (ctx)=>{
            await this.#mailingPoolScene.cancel(ctx)
        })
        mailing.on('text', async (ctx)=>{
            const answer = ctx.message.text
            if (answer && answer === 'Уверен'){
                await this.#mailingPoolScene.sending(ctx)
            }
            else if (answer && answer === 'Отмена')
            {
                await this.#mailingPoolScene.cancel(ctx);
            }
            else {
                await ctx.reply('Неожиданный ввод')
                await ctx.scene.reenter()
            }
        })
        mailing.on("message", async (ctx)=>{
            await ctx.reply("Неопознанный ввод")
            await ctx.scene.reenter()
        })
        return mailing
    }

    CreateSendingScene() {
        const sender = new Scenes.BaseScene('sender')

        sender.enter(  async (ctx) => {
            await ctx.reply("Введите сообщение, которое хотите отправить всем пользователям")
        })
        sender.leave(async ctx=>{
            await ctx.reply("Отмена ввода сообщения рассылки. Выход в меню")
        })
        sender.on("text", async ctx=>{
            const text = ctx.message.text
            const userId = ctx.message.from.id

            this.#_PgPool.query("select id from \"Users\" where id != $1", [userId])
                .then(r=>{
                    //console.log(r);
                    let promisesArray = [];
                    r.rows.forEach((item, index)=>{
                        //console.log(item);
                        const {id} = item
                        promisesArray.push(ctx.telegram.sendMessage(id, text))
                    })
                    return Promise.allSettled(promisesArray)
                })
                .then(r=>{
                    let isAll = true;
                    const rejected = r.filter((item)=>{
                        return item.status === 'rejected';
                    })
                    if (rejected.length !== 0)
                    {
                        ctx.reply("‼️‼️Сообщение отправлено НЕ всем доступным пользователям‼️‼️")
                    }
                    else {
                        ctx.reply("Сообщение отправлено всем доступным пользователям")
                    }
                })
                .catch(e=>{
                    console.error(e);
                })
        })
        sender.on("message", async ctx=>{
            await ctx.scene.leave()
        })
        return sender;

    }
}

module.exports = SceneGenerator
