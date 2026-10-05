---
title: 给 Better Stack 状态页套上 CDN：AxisNow 回源方案记录
published: 2026-10-03
tags:
  - CDN
  - 网站
description: 记录一下用 Axis CDN 加速 Better Stack 状态页，加快在中国大陆访问的首屏加载速度
aiSummary: 本文介绍了用 AxisNow CDN 回源加速 Better Stack 状态页的方法，涵盖自定义域名、CNAME、回源与 CORS 配置，可提升中国大陆首屏加载速度。
aiSummaryModel: deepseek-v4.1-flash
---
## 前言

[Better Stack](https://betterstack.com) 是一个类似于 [UptimeRobot: Free Website Monitoring Service](https://uptimerobot.com/) 的**状态检测服务平台**。其提供的状态页（Status Page）服务在中国大陆地区的访问速度较慢，因为他们用的是 `德国/萨克森自由州/法尔肯施泰因/hetzner.com` 。如果我们能让对大陆有优化的 CDN 帮我们访问 Better Stack，就能实现**加速首屏加载速度**。

CDN 选用 [AxisNow](https://www.axisnow.io)：一个支持自建私有 CDN、亦可订阅市场节点的平台。关于该 CDN 的详细介绍，可参考[二叉树树](https://www.acofork.com/)的文章：[让人惊艳的自建CDN 和节点订阅式CDN \| AcoFork](https://www.acofork.com/posts/axisnow-cdn/)

> [!IMPORTANT]重要
>需要你懂一些网站相关的基础知识，以及对**回源**、**源站**、**CORS**等名词的了解。
## 整体链路

```
浏览器 → status.adclosenn.top → AxisNow CDN 节点
CDN 节点 → (HOST: status.adclosenn.top) statuspage.betteruptime.com
```

请求经由 AxisNow 边缘节点回源至 Better Stack 的状态页服务，同时携带正确的 HOST 请求头。CDN 主要承担加速与链路优化的职责。

## 配置要点

### Better Stack 侧
1. 在你的状态页（Status Page）设置页面往下滑，找到 **Custom domain**，输入希望绑定到自己的域名（如 `status.adclosenn.top`），那么此时的设置页应该如图所示：![](/public/pic/better-stack-axisnow-cdn-5.png)
2. 先不着急配置 CNAME，但是需要打开你域名 DNS 提供商的控制面板，待会需要配置 DNS 记录。比如我这里是 Cloudflare。
### AxisNow CDN 侧

因为直接配置 Better Stack 的 CNAME 的话，我们访问到的实际 IP 是 Better Stack 提供的（德国），有时在大陆加载很慢。所以需要用 CDN 进行回源，帮助我们访问 Better Stack。

那么为什么不能先配置一个 Better Stack CNAME 到 `status-origin.adclosenn.top`，然后再回源这个，最后我在 `status.adclosenn.top` 访问？
假设你
1. 在 Better Stack 后台配置了自定义域名 **status-origin.adclosenn.top**：![](/public/pic/better-stack-axisnow-cdn-16.png)
2. CDN 回源这么配置：![](/public/pic/better-stack-axisnow-cdn-10.png)或者：![](/public/pic/better-stack-axisnow-cdn-11.png)
3. 访问 **status.adclosenn.top**：
	**前者会正常打开**，但是会导致 CORS 错误（MissingAllowOriginHeader），因为请求的资源有4个是来自 `status-origin.adclosenn.top`，不同源，所以被浏览器拦截了：![](/public/pic/better-stack-axisnow-cdn-6.png)
	![](/public/pic/better-stack-axisnow-cdn-8.png)
	可以看到，即使我处在 `status-cdn.adclosenn.top`，也照样要请求 `status-test.adclosenn.top` 的资源。
	而正常情况下是这样的：![](/public/pic/better-stack-axisnow-cdn-7.png)
	 **即使使用后者**，源站地址（不是HOST头）填写 `status-origin.adclosenn.top`，会直接 301 重定向帮你拉回 Better Stack，不让你用。所以必须填 `statuspage.betteruptime.com`。

所以得益于 Better Stack 不强制校验自定义域名的 DNS 记录，**CDN 和 Better Stack 才不会共用一个 DNS 记录**，这个时候 CDN 再直接回源到 Better Stack 绑定的域名，那4个资源就能加载成功了，因为我们 CDN 和 Better Stack 共用一个主机名（即 `status.adclosenn.top`，不再区分 -origin）了：![](/public/pic/better-stack-axisnow-cdn-9.png)

实操一下：
1. 打开 [AxisNow](https://www.axisnow.io)，没有账号的注册一个账号，然后登录到租户，用他们的 AxisNow Cloud SSO 登录。![](/public/pic/better-stack-axisnow-cdn-1.png)
2. 接下来添加源站地址与回源配置：在 `https://<租户ID>.axisnow.io/endpoint/domain/create` 中，进行如下配置：
	
	**域**：
	 - `<你在状态页后台配置的自定义域名，比如 status.adclosenn.top >`
	
	**回源配置**：
	 - 源地址：`statuspage.betteruptime.com`
	 - 回源参数：`https://<你在状态页后台配置的自定义域名，填和“域”一样的，比如 status.adclosenn.top >`
	 ![](/public/pic/better-stack-axisnow-cdn-9.png)
3. 填写完成后单击**确认**。
4. 订阅一个 CDN 提供商：[axisnow.io/zh/marketplace](https://www.axisnow.io/zh/marketplace)，选择一个服务，比如“AxisNow”，他们用的是阿里云的线路，每个月 100 GB 的免费流量：![](/public/pic/better-stack-axisnow-cdn-2.png)
5. 点击右上角的“订阅”，复制提供的邀请码：![](/public/pic/better-stack-axisnow-cdn-3.png)
6. 在 `https://<租户ID>.axisnow.io/edge/provider` 中订阅 CDN 提供商（**边缘**->**订阅-提供商**->**订阅**->**确认**）：![](/public/pic/better-stack-axisnow-cdn-4.png)
7. 点击刚订阅的提供商的“xxx CNAME”：![](/public/pic/better-stack-axisnow-cdn-12.png)
8. 把这个提供商给你的形如 `a1b2c3.alidns-1.com` 的 CNAME 复制下来：![](/public/pic/better-stack-axisnow-cdn-13.png)
9. 在你域名的 DNS 提供商（如 Cloudflare）处添加一个 **CNAME 记录**，记录值为刚才（第8步）在 AxisNow 那里获得的 CNAME（xxx.alidns-1.com）：![](/public/pic/better-stack-axisnow-cdn-14.png)
	然后保存。
10. 等待几秒，访问你的域名，发现这四个同域资源正常加载就说明成功了：![](/public/pic/better-stack-axisnow-cdn-15.png)
## 效果

接入完成后，状态页**首屏加载速度**得到明显改善，过了首屏之后还要加载剩下很多JS文件，大多来自 `incidents.betterstack.com` 等域，普通的 CDN 就到此为止了。