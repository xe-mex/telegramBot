require("dotenv").config()

const {Telegraf, Markup, Scenes, session} = require("telegraf")
    , bot = new Telegraf(process.env.BOT_TOKEN)
    , {Pool} = require("pg")
    , axios = require("axios")
    , path = require("path")


const pgPool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    password: process.env.DB_PASSWORD || "12345678",
    user: process.env.DB_USER || "postgres",
    database: process.env.DB || "postgres"
})

const SceneGenerator = require("./sense")
    , ScenesGen = new SceneGenerator(pgPool)
    , mailingScene = ScenesGen.CreateMailingPoolScene()
    , senderScene = ScenesGen.CreateSendingScene()

bot.use((ctx, next) => {
    console.log(new Date().toDateString() + ' : ' + (ctx.update.message?.text ?? ctx.update?.callback_query.data))
    next();
})

//bot.use(Telegraf.log())

const stage = new Scenes.Stage([mailingScene, senderScene])

bot.use(session())
bot.use(stage.middleware())

bot.start((ctx, next) => {
    //ctx.reply("Welcome")
    const {first_name, last_name, username, id} = ctx.update.message.from
    pgPool.query("insert into \"Users\"(id, firstname, lastname, username) values ($1, $2, $3, $4)",
        [id, first_name, last_name, username])
        .then(r => {
            console.log('Пользователь побавлен в базу данных')
        })
        .catch(e => {
            console.error(e)
        })
        .finally(() => {
            return sendMenu(ctx, 'Здравствуйте. Нажмите на любую интересующую Вас кнопку')
        })
        .finally(()=>{
            next();
        })
})

bot.command('menu', (ctx, next) => {
    sendMenu(ctx, 'Заблудились?')
        .finally(()=>{
            next();
        })
})

bot.hears('Погода в Канаде', (ctx, next) => {
    axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=43.6534817&lon=-79.3839347&units=metric&appid=${process.env.WEATHER_TOKEN}`)
        .then(r => {
            // console.log(r);
            const {temp} = r.data?.main
            return sendMenu(ctx, `Сейчас в Торонто ${temp} градусов по Цельсию`)
        })
        .catch(e => {
            console.error(e)
            return ctx.reply('Ошибка выполенния запроса');
        })
        .finally(()=>{
            next();
        })
})

bot.hears("Хочу почитать!", (ctx, next) => {
    const imageUrl = "https://pythonist.ru/wp-content/uploads/2020/03/photo_2021-02-03_10-47-04-350x2000-1.jpg"
    // const fileUrl = "https://clients6.google.com/drive/v2internal/viewerimpressions?key=AIzaSyC1eQ1xj69IdTMeii5r7brs3R90eck-m7k&alt=json"
    const message = 'Идеальный карманный справочник для быстрого ознакомления с особенностями работы разработчиков на Python. Вы найдете море краткой информации о типах и операторах в Python, именах специальных методов, встроенных функциях, исключениях и других часто используемых стандартных модулях.”'
    ctx.replyWithPhoto(imageUrl, {caption: message})
        .then((r)=>{
            //console.log(r);
            return ctx.sendDocument({source: path.resolve(__dirname, "file.zip")})
        })
        .catch(e=>{
            console.error(e);
        })
        .finally(()=>{
            next();
        })
})

bot.hears("Сделать рассылку", (ctx,next)=>{
    ctx.scene.enter("mailing")
        .then(r=>{
            //console.log(r);
        })
        .catch(e=>{
            //console.error(e);
        })
})



bot.launch()
    .then(() => {
        console.log('Бот запущен')
    })

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

function sendMenu(ctx, text) {
    return new Promise(((resolve, reject) => {
        ctx.reply(text
            , Markup.keyboard(
                [
                    Markup.button.text('Погода в Канаде'),
                    Markup.button.text('Хочу почитать!'),
                    Markup.button.text('Сделать рассылку')
                ]
            ).resize().oneTime())
            .then(()=>{
                resolve(true);
            })
            .catch(e=>{
                reject(e)
            })
    }))
}
