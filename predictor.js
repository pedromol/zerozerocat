const fs = require('fs');
const util = require('util');
const amqplib = require('amqplib');
const cv = require('@u4/opencv4nodejs');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const TelegramBot = require('node-telegram-bot-api');

const writeFile = util.promisify(fs.writeFile);

const config = {
  AMQP_CONNECTION: process.env['AMQP_CONNECTION'],
  AMQP_TOPIC: process.env['AMQP_TOPIC'],
  BUCKET_ACCESS_KEY_ID: process.env['BUCKET_ACCESS_KEY_ID'],
  BUCKET_SECRET_ACCESS_KEY: process.env['BUCKET_SECRET_ACCESS_KEY'],
  BUCKET_ENDPOINT: process.env['BUCKET_ENDPOINT'],
  BUCKET_REGION: process.env['BUCKET_REGION'],
  BUCKET_NAME: process.env['BUCKET_NAME'],
  MIN_DETECTIONS: process.env['MIN_DETECTIONS'],
  NAME_MAPPINGS: process.env['NAME_MAPPINGS']?.split(','),
  TELEGRAM_TOKEN: process.env['TELEGRAM_TOKEN'],
  TELEGRAM_CHAT: process.env['TELEGRAM_CHAT'],
};

Object.keys(config).forEach((key) => {
  if (!config[key]) {
    throw new Error('missing env ' + key);
  }
})

const s3Client = new S3Client({
  credentials: {
    accessKeyId: config.BUCKET_ACCESS_KEY_ID,
    secretAccessKey: config.BUCKET_SECRET_ACCESS_KEY,
    endpoint: config.BUCKET_ENDPOINT,
  },
  s3ForcePathStyle: !!config.BUCKET_ENDPOINT,
  sslEnabled: !config.BUCKET_ENDPOINT,
  region: config.BUCKET_REGION,
  accessKeyId: config.BUCKET_ACCESS_KEY_ID,
  secretAccessKey: config.BUCKET_SECRET_ACCESS_KEY,
  endpoint: config.BUCKET_ENDPOINT,
});

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: false });


const classifier = new cv.CascadeClassifier(cv.HAAR_FRONTALCATFACE_EXTENDED);

const listen = async () => {
  const conn = await amqplib.connect(config.AMQP_CONNECTION);

  const ch1 = await conn.createChannel();
  await ch1.assertQueue(config.AMQP_TOPIC, {
    durable: false
  });

  ch1.consume(config.AMQP_TOPIC, (msg) => {
    if (msg !== null) {
      console.log('Processing');
      const ts = Date.now();
      upload(msg.content, 'raw', ts, '')
        .then(() => predict(msg.content))
        .then((rst) => upload(rst.image, rst.who == 'Multi' ? rst.who : 'identified', ts, rst.who))
        .then((img) => bot.sendPhoto(config.TELEGRAM_CHAT, img).catch(() => console.log('Failed to send telegram photo')))
        .then(() => ch1.ack(msg));
    } else {
      console.log('Consumer cancelled by server');
      process.exit(1);
    }
  });
};

const loadLBPH = async () => {
  const lbph = new cv.LBPHFaceRecognizer();
  lbph.load('./model.yaml');
  return lbph;
}

const predict = async (img) => {
  const lbph = await loadLBPH();
  const image = cv.imdecode(img)
  if (image.empty) return image;
  const classified = classifier.detectMultiScale(image.bgrToGray());

  let identified = 0;
  let who = undefined;

  classified.objects.forEach((faceRect, i) => {
    if (classified.numDetections[i] < config.MIN_DETECTIONS) {
      return;
    }
    identified++;
    const faceImg = image.getRegion(faceRect).bgrToGray();
    who = config.NAME_MAPPINGS[lbph.predict(faceImg).label];

    const rect = cv.drawDetection(
      image,
      faceRect,
      { color: new cv.Vec(255, 0, 0), segmentFraction: 4 }
    );

    const alpha = 0.4;
    cv.drawTextBox(
      image,
      new cv.Point(rect.x, rect.y + rect.height + 10),
      [{ text: who }],
      alpha
    );
  });

  const rst = {
    image: cv.imencode('.jpeg', image),
  }

  switch (identified) {
    case 0:
      return rst
    case 1:
      return {
        who,
        ...rst,
      }
    default:
      return {
        who: 'multi',
        ...rst,
      }
  }
};

const getModel = async () => {
  const cmd = new GetObjectCommand({
    Bucket: config.BUCKET_NAME,
    Key: '/model/model.yaml'
  });

  return s3Client.send(cmd).then(r => new Response(r.Body).text());
};

const upload = async (file, type, ts, who) => {
  if (!file) return;
  const cmd = new PutObjectCommand({
    Bucket: config.BUCKET_NAME,
    Key: '/' + type + '/' + who + ts + '.jpeg',
    Body: file,
  });

  return s3Client.send(cmd).then(() => file);
};

getModel().then(file => writeFile('./model.yaml', file)).then(listen);
