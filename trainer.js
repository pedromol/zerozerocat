const fs = require('fs');
const path = require('path');
const cv = require('@u4/opencv4nodejs');
const amqplib = require('amqplib');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const { config } = require('./config')

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

const basePath = './trainer';

const listFiles = async () => {
    const cmd = new ListObjectsV2Command({
        Bucket: config.BUCKET_NAME,
        Prefix: 'identified/',
    });

    return s3Client.send(cmd).then(async (res) => res.Contents.map((f) => f.Key));
};

const getFiles = async (files) => {
    return files.map(f => {
        return getFile(f).then(async (b) => fs.writeFileSync(`${basePath}/${f.split('/').at(-1)}`, b));
    });
}

const getFile = async (path) => {
    const cmd = new GetObjectCommand({
        Bucket: config.BUCKET_NAME,
        Key: path,
    });

    return s3Client.send(cmd).then(r => new Response(r.Body).arrayBuffer().then(b => Buffer.from(b)));
};

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

const upload = async (Body, Key) => {
    const cmd = new PutObjectCommand({
        Bucket: config.BUCKET_NAME,
        Key,
        Body,
    });

    return s3Client.send(cmd).then(() => Body);
};

const listen = async () => {
    const conn = await amqplib.connect(config.AMQP_CONNECTION);

    const ch1 = await conn.createChannel();
    await ch1.assertQueue(config.AMQP_TOPIC_00_INPUT, {
        durable: false
    });

    const ch2 = await conn.createChannel();
    await ch2.assertQueue(config.AMQP_TOPIC_00_OUTPUT, {
        durable: false
    });

    ch1.consume(config.AMQP_TOPIC_00_INPUT, (msg) => {
        if (msg !== null) {
            console.log('Processing');
            process()
                .then(() => ch2.sendToQueue(config.AMQP_TOPIC_00_OUTPUT, Buffer.from(Date.now().toString(), 'utf-8')))
                .then(() => ch1.ack(msg));
        } else {
            console.log('Consumer cancelled by server');
            process.exit(1);
        }
    });
};

const process = async () => {
    return Promise.resolve(fs.mkdirSync(basePath, { recursive: true }))
        .then(listFiles)
        .then(getFiles)
        .then(p => Promise.all(p))
        .then(genModel)
        .then(() => upload(fs.readFileSync('./trainer.yaml'), '/model/model.yaml'))
        .then(() => fs.rmSync(basePath, { recursive: true }))
        .then(() => fs.rmSync('./trainer.yaml'));
};

listen();