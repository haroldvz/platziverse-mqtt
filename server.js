'use strict'


const debug = require('debug')('platziverse:mqtt')
const mosca = require('mosca')
const redis = require('redis')
const chalk = require('chalk')
const db = require('platziverse-db')

const { parsePayload } = require('./utils') //get only parsePayload function from utils module

const config = require('platziverse-db/config-db')(false)

function handleFatalError(err) {
    console.log('HANDLER')
    console.error(`${chalk.red('[fatal error]')} ${err.message}`)
    console.error(`${chalk.blue('[error stack]')} ${err.stack}`)
    process.exit(1)
}

function handleError(err) {
    console.log('HANDLER')
    console.error(`${chalk.red('[fatal error]')} ${err.message}`)
    console.error(`${chalk.blue('[error stack]')} ${err.stack}`)
}


const backend = {
    type: 'redis',
    redis,
    return_buffers: true// binary info
}

const settings = {
    port: 1883, //port server mqtt
    backend
}

const server = new mosca.Server(settings)
const clients = new Map()

let Agent, Metric


server.on('clientConnected', client => {//when the mqtt client is connected
    debug(`Client Connected: ${client.id}`)
    clients.set(client.id, null)
})

server.on('clientDisconnected',async client => {
    debug(`Client Disconnected: ${client.id}`)
    const agent = clients.get(client.id)

    if(agent){
        //Mark agent as disconnected
        agent.connected = false
        
        try {
            await Agent.createOrUpdate(agent)
        } catch (error) {
            handleError(error)
        }

        clients.delete(client.id)

        server.publish({
            type:'agent/disconnected',
            payload: JSON.stringify({
                agent:{
                    uuid:agent.uuid
                }
            })
        })

        debug(`Client with ${client.id} id associated to Agent ${agent.uuid} marked as disconnected`)
    }
})

server.on('published',async (packet, client) => {
    debug(`Received: ${packet.topic}`)//type message (agent con, agen discon, agent message)

    switch (packet.topic) {
        case 'agent/connected':
            break;
        case 'agent/disconnected':
        console.log('Disconnected')
            break;
        case 'agent/message':
            debug(`Payload ${packet.payload}`)
            const payload = parsePayload(packet.payload)
            if (payload) {
                payload.agent.connected = true

                let agent

                try {
                    agent = await Agent.createOrUpdate(payload.agent)
                } catch (error) {
                    return handleError(error)
                }

                debug(`Agent ${agent.uuid} saved`)

                if(!clients.get(client.id)){
                    clients.set(client.id, agent)
                    server.publish({
                        topic:'agent/connected',
                        payload: JSON.stringify({agent:{
                            uuid: agent.uuid,
                            name: agent.name,
                            hostname: agent.hostname,
                            pid: agent.pid,
                            connected: agent.connected
                        }})
                    })
                }

                //Store metrics

                for (let metric of payload.metrics){// for of soporta async await
                    let m

                    try {
                        m = await Metric.create(agent.uuid, metric)
                    } catch (error) {
                        return handleError(error)
                    }

                    debug(`Metric ${m.id} saved on agent ${agent.uuid}`)
                }
            }
            break;
    }

    

    debug(`Payload: ${packet.payload}`)//
})

server.on('error', handleFatalError)

// Como aqui instancio la base de datos y eso es asincrono uso async
server.on('ready', async () => {
    const services = await db(config).catch(handleFatalError)

    Agent = services.Agent
    Metric = services.Metric

    console.log(Agent)
})

//Best practices
process.on('uncaughtException', handleFatalError)

process.on('unhandleRejection', handleFatalError)

