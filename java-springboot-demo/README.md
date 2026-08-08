# 项目介绍

本项目是抖音云平台基于java语言springboot框架的开发模版，模版示例包括如下功能：

1. 免登录获取OpenID：无需维护鉴权机制及登录票据，仅一行代码即可获得。
2. 免鉴权生成小程序码：无需维护OpenApi鉴权的access_token，免鉴权调用OpenApi
3. 云数据库使用示例

## 目录结构(java-springboot-demo)

~~~
├── Dockerfile                  Dockerfile文件
├── README.md                   Readme文件
├── mvnw
├── mvnw.cmd
├── pom.xml                     maven配置文件
├── run.sh                      启动脚本
├── settings.xml                maven配置文件
├── src                         源代码
│ ├── main
│ │ ├── java
│ │ │ └── com
│ │ │     └── bytedance
│ │ │         └── douyinclouddemo   示例代码
│ │ └── resources
│ │     └── application.yml     springboot文件
│ └── test                      
└── target
~~~

## 请求方法

前往抖音云托管云函数平台，进行请求调试。

## API 说明

### `GET /get_open_id`

获取 openid，当未绑定用户时会返回获取 openid 失败的错误
当小程序客户端通过 callContainer 的方式请求抖音云上的服务器时，抖音云网关会自动获取 openid,并将 openid 注入到请求头 X-TT-OPENID 中。

### 响应结果

```json
{
  "code": 0,
  "message": "",
  "data": "719f****-****-4c**-a0**-*********"
}
```

### `POST /antidirt`

云调用示例，调用抖音开放平台的 OpenApi 进行检测一段文本是否包含违法违规内容。

### 请求参数

```json
{
  "tasks": [
    {
      "content": "要检测的文本"
    }
  ]
}
```

### 响应结果

正常返回

```json
{
  "log_id": "202008181611370100150421452708466F",
  "data": [
    {
      "msg": "",
      "code": 0,
      "task_id": "MICROAPP_6862233737027911687",
      "predicts": [
        {
          "prob": 0,
          "hit": false,
          "target": null,
          "model_name": "short_content_antidirt"
        }
      ],
      "data_id": null
    }
  ]
}
```

错误返回

```json
{
  "error_id": "7bf3b7e299e9448796aa99b44750df68",
  "code": 401,
  "message": "[app token sign fail] bad token",
  "exception": "[app token sign fail] bad token"
}
```

### `POST /insert_record`

向云数据库中插入一条数据，云数据库服务端暂时仅支持nodejs语言，请参考快速开始云函数模板。

### `GET /select_record`

从云数据库查询 demo 数据，云数据库服务端暂时仅支持nodejs语言，请参考快速开始云函数模板。

### `POST /update_record`

从云数据库更新 demo 数据，云数据库服务端暂时仅支持nodejs语言，请参考快速开始云函数模板。


## License
This project is licensed under the [Apache-2.0 License](LICENSE).

