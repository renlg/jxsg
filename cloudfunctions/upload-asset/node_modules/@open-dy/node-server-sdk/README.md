# @open-dy/node-server-sdk
抖音云 node 服务端sdk
## 安装
```
yarn add @open-dy/node-server-sdk
```

## 使用方式
```
import { dySDK }  from '@open-dy/node-server-sdk';
const database = dySDK.database();
const res = await database.collection('todos').get();
```
