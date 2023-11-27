const fs = require('fs');
const util = require('util');
const path = require('path');
const fastify = require('fastify')
const cv = require('@u4/opencv4nodejs');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const TelegramBot = require('node-telegram-bot-api');
const writeFile = util.promisify(fs.writeFile);

const config = {
  BUCKET_ACCESS_KEY_ID: process.env['BUCKET_ACCESS_KEY_ID'],
  BUCKET_SECRET_ACCESS_KEY: process.env['BUCKET_SECRET_ACCESS_KEY'],
  BUCKET_ENDPOINT: process.env['BUCKET_ENDPOINT'],
  BUCKET_REGION: process.env['BUCKET_REGION'],
  BUCKET_NAME: process.env['BUCKET_NAME'],
  MIN_DETECTIONS: process.env['MIN_DETECTIONS'],
  NAME_MAPPINGS: process.env['NAME_MAPPINGS']?.split(','),
  TELEGRAM_TOKEN: process.env['TELEGRAM_TOKEN'],
  TELEGRAM_CHAT: process.env['TELEGRAM_CHAT'],
  HTTP_PORT: process.env['HTTP_PORT'],
};

Object.keys(config).forEach((key) => {
  if (!config[key]) {
    throw new Error('missing env ' + key);
  }
})

console.log(`Starting with config:
`+ JSON.stringify({ ...config, BUCKET_SECRET_ACCESS_KEY: '***', TELEGRAM_TOKEN: '***' }, undefined, '  '));

const basePath = './trainer';

const s3Client = new S3Client({
  credentials: {
    accessKeyId: config.BUCKET_ACCESS_KEY_ID,
    secretAccessKey: config.BUCKET_SECRET_ACCESS_KEY,
    endpoint: config.BUCKET_ENDPOINT,
  },
  s3ForcePathStyle: !!config.BUCKET_ENDPOINT,
  forcePathStyle: !!config.BUCKET_ENDPOINT,
  sslEnabled: !config.BUCKET_ENDPOINT,
  region: config.BUCKET_REGION,
  accessKeyId: config.BUCKET_ACCESS_KEY_ID,
  secretAccessKey: config.BUCKET_SECRET_ACCESS_KEY,
  endpoint: config.BUCKET_ENDPOINT,
});

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });

const classifier = new cv.CascadeClassifier('./haarcascade_frontalcatface_extended.xml');

const processPredict = async (path) => {
  console.log(`Processing prediction for ${path}`);
  const ts = path.split('/').at(-1).split('.').at(0);
  const key = path.replace(config.BUCKET_NAME + '/', '');
  return download(key)
    .then(predict)
    .then((rst) => {
      let result = upload(rst.originalImage, 'identified', ts, rst.who);
      if (rst.who) {
        result = result
          .then(bot.sendPhoto(config.TELEGRAM_CHAT, rst.image)
            .then(msg => uploadKey(Buffer.from(''), `/message/${msg.message_id}-${rst.who}${ts}`))
            .catch(() => console.log('Failed to send telegram photo')));
      }
      console.log(`Prediction result: ${rst.who}`);
      return result;
    });
};

const processTrain = async () => {
  console.log(`Training model`)
  return Promise.resolve(fs.mkdirSync(basePath, { recursive: true }))
    .then(() => listFiles('identified/L'))
    .then(getFiles)
    .then(p => Promise.all(p))
    .then(genModel)
    .then(() => uploadKey(fs.readFileSync('./trainer.yaml'), '/model/model.yaml'))
    .then(() => fs.rmSync(basePath, { recursive: true }))
    .then(() => fs.rmSync('./trainer.yaml'));
};

const listen = async () => {
  const server = fastify({ logger: true });

  server.post('/', (request, reply) => {
    if (request.body.Key?.includes('raw')) {
      processPredict(request.body.Key).then(() => reply.send({ status: 'ok' }));
    } else if (request.body.Key?.includes('identified')) {
      processTrain().then(() => reply.send({ status: 'ok' }));
    } else if (request.body.Key?.includes('model')) {
      getModel().then(() => reply.send({ status: 'ok' }));
    } else {
      reply.send({ status: 'ok' })
    }
  });

  server.listen({ port: config.HTTP_PORT, host: '0.0.0.0' }, (err) => {
    if (err) throw err
  });
};

const listFiles = async (prefix) => {
  const cmd = new ListObjectsV2Command({
    Bucket: config.BUCKET_NAME,
    Prefix: prefix,
  });

  return s3Client.send(cmd).then(async (res) => {
    if (res.KeyCount < 1) return [];
    return res.Contents.map((f) => f.Key)
  });
};

const getFiles = async (files) => {
  return files.map(f => {
    return download(f).then(async (b) => fs.writeFileSync(`${basePath}/${f.split('/').at(-1)}`, b));
  });
}

const genModel = async () => {
  const classifier = new cv.CascadeClassifier(cv.HAAR_FRONTALCATFACE_EXTENDED);

  const imgFiles = fs.readdirSync(basePath);

  const trainData = imgFiles
    .map(file => {
      const label = config.NAME_MAPPINGS.findIndex(name => file.includes(name));
      if (label < 0) {
        return undefined;
      }

      const absPath = path.resolve(basePath, file);
      const originalImage = cv.imread(absPath);

      const faceRects = classifier.detectMultiScale(originalImage).objects;
      if (!faceRects.length) {
        return undefined;
      }

      return {
        grayImage: originalImage.getRegion(faceRects[0]).bgrToGray().resize(80, 80),
        label,
      };
    })
    .filter(train => train);

  const lbph = new cv.LBPHFaceRecognizer();
  lbph.train(trainData.map(t => t.grayImage), trainData.map(t => t.label));
  lbph.save('./trainer.yaml');
}

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
    originalImage: img,
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

const download = async (key) => {
  const cmd = new GetObjectCommand({
    Bucket: config.BUCKET_NAME,
    Key: key,
  });

  return s3Client.send(cmd).then(r => new Response(r.Body).arrayBuffer().then(b => Buffer.from(b)));
};

const getModel = async () => {
  console.log('Updating model');
  return download('/model/model.yaml').then(file => writeFile('./model.yaml', file));
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

const uploadKey = async (file, key) => {
  if (!file) return;
  const cmd = new PutObjectCommand({
    Bucket: config.BUCKET_NAME,
    Key: key,
    Body: file,
  });

  return s3Client.send(cmd).then(() => file);
};

const removeKey = async (key) => {
  if (!key) return;
  const cmd = new DeleteObjectCommand({
    Bucket: config.BUCKET_NAME,
    Key: key,
  });

  return s3Client.send(cmd).then(() => key);
}

bot.on('message', (msg) => {
  if (msg.chat.id == config.TELEGRAM_CHAT && msg.reply_to_message?.message_id) {
    const newWho = [...config.NAME_MAPPINGS, 'errado'].find(w => w == msg.text);
    if (!newWho) return;
    listFiles(`message/${msg.reply_to_message.message_id}`).then(ids => {
      if (ids.length != 1) {
        return bot.sendMessage(config.TELEGRAM_CHAT, 'id not found :(', { reply_to_message_id: msg.message_id });
      }
      const original = ids[0].split('-').at(-1);
      const name = config.NAME_MAPPINGS.filter(n => original.includes(n));
      if (name.length != 1) {
        return bot.sendMessage(config.TELEGRAM_CHAT, 'name not found :(', { reply_to_message_id: msg.message_id });
      }
      if (name[0] == newWho) {
        return bot.sendMessage(config.TELEGRAM_CHAT, 'hey! it\'s the same I predicted!', { reply_to_message_id: msg.message_id });
      }
      const ts = original.replace(name[0], '');
      const oldKey = `identified/${original}.jpeg`;
      download(oldKey).then((file) => {
        return removeKey(oldKey)
          .then(() => upload(file, 'identified', ts, newWho == 'errado' ? 'undefined' : newWho))
          .then(() => bot.sendMessage(config.TELEGRAM_CHAT, 'ooooh quei', { reply_to_message_id: msg.message_id }))
      }).catch(() => bot.sendMessage(config.TELEGRAM_CHAT, 'already done', { reply_to_message_id: msg.message_id }))
    })
  }
});

getModel().then(listen);
