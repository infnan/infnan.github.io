---
layout: post
title: 使用脚本快速从本地提取、替换生产服务器class文件
category: 系统运维
tags:
 - shell
---
生产环境遇到bug，需要紧急修改几个Java文件，然后尽快部署到生产系统中。如果代码中混有其他改动，无法完整打包，那么如何尽快提取出改完的class文件并快速地放到服务器的正确位置呢？

<!-- more -->

# 从本机提取文件
先在自己的IDE中把代码改出来，编译，运行。避免打WAR包，否则还要费心思解压，而且有些系统（例如Mac）解出来之后时间戳还不对。

重新生成的class文件的修改时间肯定比其他class文件新，这样我们就能用一些脚本将它们挑出来了。

## Windows系统
使用PowerShell脚本。放在 D:\\tiqu.ps1 中：
```powershell
[CmdletBinding()]
Param (
    [string] 
    $from = '.', 

    [string]
    $to = '..\output',

    [AllowNull()]
    [string]
    $time,

    [AllowNull()]
    [int]
    $min,

    [int]
    $flat = 0
)

if ($time) {
    $minTime = [DateTime]::ParseExact($time, 'hh:mm', $null)
} elseif ($min) {
    $minTime = (Get-Date).AddMinutes(-$min);
} else {
    $minTime = [DateTime]::ParseExact('00', 'hh', $null)
}

# 新建文件夹
New-Item -Path $to -ItemType Directory -Force | Out-Null

# 搜索文件
Push-Location $from

$fileList = Get-ChildItem -Path . -Recurse | ? {$_.LastWriteTime -gt $minTime}
foreach ($file in $fileList) {
    $relativePath = Resolve-Path -Path $file.FullName -Relative
    
    if ($flat -eq 0) {
        # 保持目录结构
        Write-Output $relativePath
        $newPath = Join-Path -Path $to -ChildPath $relativePath
        $newDir = Split-Path -Path $newPath
        New-Item -Path $newDir -ItemType Directory -Force | Out-Null
        Copy-Item -Path $file.FullName -Destination $newDir -Force | Out-Null
    } else {
        # 不保持目录结构，直接复制
        Write-Output $file.Name
        Copy-Item -Path $file.FullName -Destination $to -Force | Out-Null
    }
}

Pop-Location
```

操作时，启动PowerShell，输入

```powershell
# 进入到Web应用所在目录，IDEA通常是artifacts，Eclipse通常是WebRoot
cd X:\xxxxxx\out\artifacts

# 提取5分钟之前到现在修改的文件，放到 ..\临时替换 目录中
D:\tiqu.ps1 -to ..\临时替换 -min 5

# 提取从9:20到现在之间修改的文件，放到 ..\output 目录中
D:\tiqu.ps1 -time 09:20 
```

## Linux/Mac/Cygwin
将以下脚本放在`/usr/local/bin/tiqu`中，设置好`x`权限。

注意Mac系统自带getopt是BSD版本，功能比GNU版少，只支持一个字母的短参数，需另外安装gnu-getopt（后面假设安装到了`/usr/local/opt/gnu-getopt/bin/getopt`）。

```bash
#!/bin/bash
 
help() {
    echo "tiqu [options]"
    echo "默认值：把当前目录、当天修改文件放到 out 目录中"
    echo
    echo "  --from=<path>, -f       指定待查找目录"
    echo "  --to=<path>, -t         指定放置位置，如果没有则自动 mkdir"
    echo "  --time=<HH:mm>          复制 HH:mm 之后修改的文件"
    echo "  --min=<min>             复制从 min 分钟之前到现在的文件，和上面参数冲突"
    echo "  --exclude=<list>, -e    复制时排除符合<list>规则的文件"
    echo "  --exclude-from=<file>   复制时排除匹配了<file>规则配置列表文件的文件"
    echo "  --flat, -b              把所有文件平摊到同一目录中，不要保持目录结构（默认值：保持目录结构）"
    echo "  --help                  显示本帮助"
    echo
}
 
fromPath="."
toPath="./out"
findTime="00:00"
findMin=-1
excludeCmd=""
flat=0
 
# 苹果系统
export PATH="/usr/local/opt/gnu-getopt/bin:$PATH"
 
TEMP=`getopt -o hf:t:e:b --long help,from:,to:,time:,min:,exclude:,exclude-from,flat -- "$@"`
eval set -- "$TEMP"
 
while true; do
    case "$1" in
        -f|--from)
            fromPath="$2"
            shift 2
            ;;
        -t|--to)
            toPath="$2"
            shift 2
            ;;
        --time)
            if [[ "$2" =~ ^[01]?[0-9]:[0-5][0-9]$ ]]; then
                findTime="$2"
            else
                echo 错误：无效时间格式！
                exit 1
            fi
            shift 2
            ;;
        --min)
            findMin="$2"
            shift 2
            ;;
        -e|--exclude)
            excludeCmd="--exclude=\"$2\""
            shift 2
            ;;
        --exclude-from)
            excludeCmd="--exclude-from=\"$2\""
            shift 2
            ;;
        -b|--flat)
            flat=1
            shift 1
            ;;
        -h|--help)
            help
            exit 0
            ;;
        --)
            shift
            break
            ;;
        *)
            # echo "Internal error!"
            # exit 1
            ;;
    esac
done
 
# 计算时间
if [ $findMin -eq -1 ]; then
    IFS=: read nowh nowm nows <<< "`date +%T`"
    IFS=: read bh bm <<< "$findTime"

    nowh=${nowh#0}
    nowm=${nowm#0}
    bh=${bh#0}
    bm=${bm#0}
 
    findMin=$(((nowh*60+nowm)-(bh*60+bm)))
    if [ $findMin -lt 0 ]; then
        findMin=0
    fi
fi
 
findMin=$((-findMin))
 
# 将toPath转成绝对路径
mkdir -p "$toPath"
cd "$toPath"
toPath="`pwd`"
cd -
 
# 使用rsync复制文件
cd "$fromPath"
if [ $flat -eq 0 ]; then
    # 保持目录结构
    find . -type f -mmin $findMin -exec rsync -aR {} "$toPath" \;
else
    # 不要保持目录结构
    find . -type f -mmin $findMin -exec rsync -a {} "$toPath" \;
fi
 
# 展示已复制文件
cd "$toPath"
find .
```

操作时：

```bash
# 进入到Web应用所在目录，IDEA通常是artifacts，Eclipse通常是WebRoot
cd xxxxxx/out/artifacts

# 提取5分钟之前到现在修改的文件，放到 ../临时替换 目录中
tiqu --to=../临时替换 --min=5

# 提取从9:20到现在之间修改到文件，放到 ./out 目录中
tiqu --time=9:20 
```

程序会自动搜索已修改文件，并且会按目录结构组织好，之后你就可以直接打包了。

# 在服务器上替换（Linux）
如果已经按目录结构整理好，直接解压替换（`unzip -o xxx.zip -d 应用所在目录`）便是。对于war包，可使用zip命令直接把文件替换到包里面（`cd xxx; zip -r war包 *`）。

如果提供的是散装的class文件，那么找目录会很费劲，可以借助脚本自动找目录，自动替换。可修改以下脚本中的MYBASE变量，然后保存到`/usr/local/bin/tihuan`中，加好`x`权限：

```bash
#!/bin/bash

# 应用所在位置。通常不会变化，可以写死在脚本里头。
MYBASE=/opt/xxx

help() {
    echo "tihuan [options] 文件名1 文件名2 ..."
    echo
    echo "  --to=<path>, -t         指定搜索目录（默认值：${MYBASE}）"
    echo "  --dry-run, -n           只生成命令，不要实际替换"
    echo "  --force, -f             不用确认，直接动手替换"
    echo "  --help                  显示本帮助"
}
 
# 苹果系统
export PATH="/usr/local/opt/gnu-getopt/bin:$PATH"
 
TEMP=`getopt -o ht:nf --long help,to:,dry-run,force -- "$@"`
eval set -- "$TEMP"

toPath="$MYBASE"
dryrun=0
force=0
 
while true; do
    case "$1" in
        -t|--to)
            toPath="$2"
            shift 2
            ;;
        -n|--dry-run)
            dryrun=1
            shift 1
            ;;
        -f|--force)
            force=1
            shift 1
            ;;
        -h|--help)
            help
            exit 0
            ;;
        --)
            shift
            break
            ;;
        *)
            # echo "Internal error!"
            # exit 1
            ;;
    esac
done

i=0
for file in "$@"; do
    i=$((i+1))

    if ! [ -f "$file" ]; then
        >&2 echo "[文件 #${i}] 源文件不存在：${file}"
        continue
    fi

    fileName=`basename "$file"`

    find "$toPath" -name "$fileName" > /tmp/tmpfilelist
    list=`cat /tmp/tmpfilelist`

    if [ -n "$list" ] && [ "$list" != "\n" ]; then
        echo "[文件 #${i}] 已找到"

        cat /tmp/tmpfilelist | while read target; do
            echo $target
        done

        if [ $force -eq 0 ]; then
            echo -n "是否继续替换 [y/n]？"
            read choice
        else
            choice="y"
        fi

        if [ "$choice" == "y" ]; then
            if [ $dryrun -eq 0 ]; then
                echo "[文件 #${i}] 已进行替换"
            else
                echo "[文件 #${i}] 请运行以下命令"
            fi
            cat /tmp/tmpfilelist | while read target; do
                if [ $dryrun -eq 0 ]; then
                    cp "$1" "$target"
                else
                    echo "cp \"$file\" \"$target\""
                fi
            done
        else
            echo "[文件 #${i}] 已放弃替换"
        fi
    else
        echo "[文件 #${i}] 未找到文件，未进行替换"
    fi

    echo
done

rm /tmp/tmpfilelist 2> /dev/null
```

操作时：
```bash
# 此处省略下载文件与备份操作。实际操作时注意备份！
# 以下根据实际情况二选一

# 展开（exploded）模式
tihuan XXXXX.class

# war包模式
mkdir tmp
unzip -o war包 -d tmp
tihuan --to=tmp XXXXX.class
cd tmp
zip -r 原先的war包 *
```

# 后续操作
* 本文的操作应当只用于应急处置。问题处理好之后，代码该提交提交，基线该打patch打patch，忘了的话就是极大的隐患。
* 这次事情紧急，直接从开发库中取了文件。给不紧急的bug打patch时，一定要取基线代码，从基线上打，打完再合并回去。
* 每次正式升级之前一定要打基线，从基线取代码，打整包，生产环境配置文件用事先预备好的备份覆盖升级包，不要单独换文件！换文件升级，有第一次，就会有第二次。越是换文件，后面就越不敢打整包，几个星期以后，全世界就没有人知道生产环境与本地代码有什么区别了。
