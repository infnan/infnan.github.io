---
layout: post
title: 在Web开发中，如果无法回避ActiveX控件——一种让用户在非IE浏览器调用控件的思路
category: 项目开发经验
tags:
- ActiveX
---
如果Web系统需要调用特定ActiveX控件才能操作，像身份证阅读器、读卡器、获取电脑网卡MAC地址等，而且预计控件厂商在一段时间内无法解决浏览器兼容性问题，那我们能不能想法让用户在非IE浏览器中也能调用控件呢？

本文提出一种解决思路：开发一个“控件小助手”代理程序。该程序安装在用户电脑中，负责调用ActiveX控件，并在本地建立一个简易Web Server，而业务系统相关页面则通过Ajax（备注：实际是JSONP）调用代理接口，从而间接地与控件交互。

<!-- more -->

# 说明
假设业务系统未开启HTTPS，因为启用HTTPS后问题会变得复杂。

# 示意图
以身份证阅读器为例：
```
|-----------------------------------|                      |
|              IE浏览器              |      Windows系统      |      外设
|                                   |                      |
|  |------------|   |------------|  |                      |
|  | JavaScript |---| ActiveX控件 |-------身份证阅读器驱动--------身份证阅读器
|  |------------|   |------------|  |                      |
|                                   |                      |
|-----------------------------------|                      |
```

ActiveX是微软专利，其他浏览器无法调用。然而，在用户电脑中安装一个代理程序（即“控件小助手”），便可通过代理程序来操作控件：

```
                             |------------------------------------|                |
|------------------|         |               代理程序              |   Windows系统   |      外设
|   Chrome浏览器    |         |                                    |                |
|                  |         |  |--------------|   |----------|   |                |
|  |------------|  |         |  |     小型      |   | ActiveX  |  |     身份证       |
|  | JavaScript |-----JSONP-----|  Web Server  |---|   控件    |--------阅读器-----------身份证阅读器
|  |------------|  |         |  |--------------|   |----------|   |     驱动        |
|                  |         |                                    |                |
|------------------|         |------------------------------------|                |
```

# 原型
假设原先的读卡逻辑为：
```html
<button type="button" id="readCardButton" onclick="readCard()">读取身份证</button>
<script type="text/javascript">
    function readCard() {
        if (window.cardReader.Check) {
            var check = window.cardReader.Check();
            if (check > 0) {
                var ret = window.cardReader.ReadCard();
                if (ret !== 0) {
                    // 读取不成功，需要重试
                    setTimeout(function () {
                        readCard()
                    }, 1000);
                } else {
                    alert('读卡成功！身份证号码为' + window.cardReader.IdCard);
                }
            } else {
                alert('无法读取身份证，请检查身份证阅读器是否连接到电脑，驱动是否正确安装！');
            }
        } else {
            alert('无法读取身份证，请检查身份证阅读器控件是否正确安装！');
        }
    }
</script>
<object classid="clsid:xxxxxx" id="cardReader" width="0" height="0"></object>
```

## 小助手原型
我们采用C#快速实现原型程序，这样的话需要提前准备好Visual Studio。

进入Visual Studio，新建“Windows 窗体应用 (.Net Framework)”，命名为ControlHelper，并在NuGet管理器中安装[Nancy](https://github.com/NancyFx/Nancy)。在窗体Form1中添加身份证阅读器控件，命名为CardReader。

Form1.cs代码如下：
```csharp
using Nancy.Hosting.Self;
using System;
using System.Windows.Forms;
using System.Threading.Tasks;

namespace ControlHelper
{
    public partial class Form1 : Form
    {
        private NancyHost server = null;

        public Form1()
        {
            InitializeComponent();
        }

        private void Form1_Load(object sender, EventArgs e)
        {
            // 启动Web Server
            server = new NancyHost(new Uri("http://127.0.0.1:12345"));
            server.Start();
        }

        public CheckResult Check()
        {
            var ret = CardReader.Check();
            var obj = new CheckResult();

            if (ret > 0)
            {
                obj.Result = 1;
                obj.Message = "身份证阅读器检测成功！";
            }
            else
            {
                obj.Result = 0;
                obj.Message = "无法读取身份证，请检查身份证阅读器是否连接到电脑，驱动是否正确安装！";
            }

            return obj;
        }

        public async Task<IdCard> ReadIdCard()
        {
            var obj = new IdCard();

            obj.result = 0;
            obj.message = "无法读取身份证，请重试！";

            try
            {
                for (var retry = 3; retry > 0; retry--)
                {
                    var ret = CardReader.ReadCard();
                    if (ret == 0)
                    {
                        obj.Result = 1;
                        obj.Message = "读卡成功";
                        obj.IdCard = CardReader.IdCard;
                        // 此处省略其他属性
                        break;
                    }
                    System.Threading.Thread.Sleep(1000);
                }
            }
            catch (Exception e)
            {
                
            }
            return obj;
        }
    }
}
```

Helper.cs：
```csharp
using Nancy;
using System;

namespace ControlHelper
{
    public class Helper : NancyModule
    {
        public Helper()
        {
            Get("/idcard/check", param => Response.AsJson(Program.mainForm.Check()));

            // 读卡不一定能立刻返回结果，使用async
            Get("/idcard/read", async (context, t) => Response.AsJson(await Program.mainForm.ReadIdCard()));
        }
    }

    [Serializable]
    public class IdCard
    {
        public int Result { get; set; }
        public string Message { get; set; }
        public string IdCard { get; set; }
        // ...
        // 其他属性：姓名、性别、民族、出生日期、地址、签发机关、有效期、照片等
    }

    [Serializable]
    public class CheckResult
    {
        public int Result { get; set; }
        public string Message { get; set; }
    }
}
```

代码中的监听端口为12345。为了避免冲突，可以修改成其他端口（最大65535，尽量用五位数）。由于监听地址为127.0.0.1（本机），与业务系统不同，会涉及跨域问题。为了避免离题讨论，本文代码以GET方式提供服务，并返回JSON格式数据，以便业务系统通过JSONP调用，不使用POST。

## Web应用页面代码调整
调整读卡按钮的逻辑，先判断ActiveX控件是否可用。如果可用，沿用原先的ActiveX操作方式；如果不可用，则尝试通过$.ajax向“小助手”的小型Web Server发送请求。

```javascript
function readCardNew() {
    $('#readCardButton').prop('disabled', true);
    // 先尝试调用ActiveX控件，调不通的话就调用辅助程序
    if (window.cardreader.ReadCard) {
        readCard();
        $('#readCardButton').prop('disabled', false);
    } else {
        $.ajax({
            url: 'http://localhost:12345/idcard/check',
            dataType: 'jsonp',
            timeout: 500,
            cache: false,
            success: function (data1) {
                if (data1.Result === 0) {
                    alert(data1.Message);
                    $('#readCardButton').prop('disabled', false);
                } else {
                    $.ajax({
                        url: 'http://localhost:12345/idcard/read',
                        dataType: 'jsonp',
                        cache: false,
                        success: function (data2) {
                            $('#readCardButton').prop('disabled', false);
                            if (data2.Result === 0) {
                                alert(data2.Message);
                            } else {
                                alert('读卡成功！身份证号为' + data2.IdCard);
                            }
                        },
                        error: function () {
                            alert('无法读取身份证，请重试！');
                            $('#readCardButton').prop('disabled', false);
                        }
                    });
                }
            },
            error: function () {
                alert('无法读取身份证，请检查小助手是否启动！');
                $('#readCardButton').prop('disabled', false);
            }
        });
    }
}
```

# 投入商业使用之前
以上是实验用原型，质量粗糙，还需要进行一些功能优化才能交付用户，例如：
* 兼顾不同操作系统的兼容性，以及不同版本.Net Framework的兼容性。（建议使用Visual C++重新开发）
* 增加校验，检测用户是否已经正确安装驱动和控件，并帮助用户完成安装（需注意遵守驱动和控件的许可协议，以免吃官司）。目前状态下，如控件未正确安装，程序一启动就会崩溃。
* 增加开机自启、版本更新等功能。

如果团队有Windows桌面应用开发经验，或者能够接受研发成本，可以考虑进一步将工具开发出来，满足用户需求，解决实际问题。当然，无论是从解决问题的角度来看，还是从开发成本的角度来看，让控件厂商去做浏览器兼容才是最合适的解决办法。

## 关于HTTPS
在决定开发之前，还需要特别留意一个问题：业务系统若进行HTTPS改造，“小助手”将完全失效，因为浏览器会拒绝HTTPS网站访问HTTP网站。这是浏览器的安全特性，JavaScript脚本无法干预此行为。

这样的话，需要为“localhost”签发（自签名）证书，让“小助手”也使用HTTPS服务，并要求用户（或通过安装程序自动地）将该证书添加到系统信任中。注意，除了操作系统证书库，Firefox也有自己的证书库，因此Firefox浏览器要另外添加信任。

# 进一步思考
从上面代码可以看出，控件读取的身份证号是明文，用户可通过浏览器控制台等途径篡改数据，带来安全隐患，而且这个漏洞无法在前端与控件层面补救。但是，如果全面改用“小助手”，便可在“小助手”一端“动手脚”，用可逆算法加密身份证信息，传到服务器之后才进行解密，从而防止用户在浏览器非法录入信息或篡改数据。
