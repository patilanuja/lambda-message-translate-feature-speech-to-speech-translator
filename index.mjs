'use strict';

import pg from 'pg';
const { Client } = pg;

import { SQSClient, SendMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

import AWS from 'aws-sdk';
const translate = new AWS.Translate();

const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    schema: process.env.DB_SCHEMA,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false
    }
});

client.connect();

const sqsClient = new SQSClient({
    signatureVersion: 'v4',
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_KEY
    }
});

const language = {
    'Arabic': 'ar',
    'Danish': 'da',
    'Dutch': 'nl',
    'English': 'en',
    'French': 'fr',
    'German': 'de',
    'Hindi': 'hi',
    'Italian': 'it',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Portuguese': 'pt-PT',
    'Russian': 'ru',
    'Spanish': 'es',
    'Swedish': 'sv',
    'Turkish': 'tr'
}

export const handler = async (event, context) => {
    console.log('Event: ' + JSON.stringify(event));
    console.log('Context: ' + JSON.stringify(context));
    try {
        let messageId = parseInt(event['Records'][0]['body']);
        let message = await getMessage(messageId);
        let translated = await translate.translateText({
            SourceLanguageCode: language[message.language_from],
            TargetLanguageCode: language[message.language_to],
            Text: message.transcribed
        }).promise();
        console.log(translated)
        updateMessage(messageId, translated.TranslatedText);
        let data = await sqsClient.send(new SendMessageCommand({
            QueueUrl: process.env.AWS_SQS_GENERATE,
            MessageBody: '' + messageId
        }));
        console.log(data);
        await sqsClient.send(new DeleteMessageCommand({
            QueueUrl: process.env.AWS_SQS_TRANSLATE,
            ReceiptHandle: event.Records[0].receiptHandle
        }));
    } catch (error) {
        console.error(error);
    }
};

const getMessage = async (messageId) => {
    let result = await client.query('select id, from_, to_, language_from, language_to, source, source_content_type, transcribed, created, modified from lingualol.message where id = $1',
        [messageId]);
    console.log(result.rows);
    return result.rows[0];
}

const updateMessage = async (id, translated) => {
    await client.query('update lingualol.message set translated = $1 where id = $2', [translated, id]);
}