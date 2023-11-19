const config = {
    AMQP_CONNECTION: process.env['AMQP_CONNECTION'],
    AMQP_TOPIC: process.env['AMQP_TOPIC'],
    AMQP_TOPIC_00_INPUT: process.env['AMQP_TOPIC_00_INPUT'],
    AMQP_TOPIC_00_OUTPUT: process.env['AMQP_TOPIC_00_OUTPUT'],
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

console.log(`Starting with config:
`+ JSON.stringify({ ...config, AMQP_CONNECTION: '***', BUCKET_SECRET_ACCESS_KEY: '***', TELEGRAM_TOKEN: '***' }, undefined, '  '));

module.exports = { config }
