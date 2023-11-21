const fs = require('fs');
const util = require('util');
const path = require('path');
const fastify = require('fastify')
const cv = require('@u4/opencv4nodejs');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
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

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: false });

const classifier = new cv.CascadeClassifier(cv.HAAR_FRONTALCATFACE_EXTENDED);

const processPredict = async (path) => {
  console.log(`Processing prediction for ${path}`);
  const ts = path.split('/').at(-1).split('.').at(0);
  const key = path.replace(cfg.BUCKET_NAME + '/', '');
  return download(key)
    .then(predict)
    .then((rst) => upload(rst.image, rst.who == 'Multi' ? rst.who : 'identified', ts, rst.who))
    .then((img) => bot.sendPhoto(config.TELEGRAM_CHAT, img).catch(() => console.log('Failed to send telegram photo')));
};

const processTrain = async () => {
  console.log(`Training model`)
  return Promise.resolve(fs.mkdirSync(basePath, { recursive: true }))
    .then(listFiles)
    .then(getFiles)
    .then(p => Promise.all(p))
    .then(genModel)
    .then(() => upload(fs.readFileSync('./trainer.yaml'), '/model/model.yaml'))
    .then(() => fs.rmSync(basePath, { recursive: true }))
    .then(() => fs.rmSync('./trainer.yaml'));
};

const listen = async () => {
  const server = fastify({ logger: true });

  server.post('/', (request, reply) => {
    if (request.body.Key?.contains('raw')) {
      processPredict(request.body.Key).then(() => reply.send({ status: 'ok' }));
    } else if (request.body.Key?.contains('identified')) {
      processTrain().then(() => reply.send({ status: 'ok' }));
    } else if (request.body.Key?.contains('model')) {
      console.log('Updating model');
      getModel().then(() => reply.send({ status: 'ok' }));
    } else {
      reply.send({ status: 'ok' })
    }
  });

  server.listen({ port: config.HTTP_PORT, host: '0.0.0.0' }, (err) => {
    if (err) throw err
  });
};

const listFiles = async () => {
  const cmd = new ListObjectsV2Command({
    Bucket: config.BUCKET_NAME,
    Prefix: 'identified/',
  });

  return s3Client.send(cmd).then(async (res) => res.Contents.map((f) => f.Key));
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
        console.log('Ignoring file by nameMapping: ' + file)
        return undefined;
      }

      const absPath = path.resolve(basePath, file);
      const originalImage = cv.imread(absPath);

      const faceRects = classifier.detectMultiScale(originalImage).objects;
      if (!faceRects.length) {
        console.log('Ignoring file by faceRects: ' + file)
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

getModel().then(listen);
