# platziverse-mqtt

## `agent/connected`


``` js
{

    agent: { // see agent model
        uuid, //auto
        username,// config definition
        name, // config definition
        hostname, // get from OS
        pid// get from procces
    }// info to sends to mqtt server

}
```


## `agent/disconnected`


``` js
{// message when agent is disconnected, just send uuid

    agent: {
        uuid, //auto
    }// 

}
```


## `agent/message`

``` js
{// message when agent is disconnected, just send uuid

    agent,
    metrics: [
        {// see metric model
            type,
            value
        }
    ],
    timestamp// generate when the message is created
}
```