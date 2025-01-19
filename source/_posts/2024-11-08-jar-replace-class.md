---
layout: post
title: 在Linux服务器内，给jar包快速替换其内部文件的脚本
category: 记录
tags:
---

开发时有时会遇到反复调试、需要反复替换某个class，但是整个jar包上传太慢，等jar包很浪费时间的事情。可以写个脚本实现替换个别文件。

<!-- more -->

## 代码

创建一个文件，内容为：

```bash
#!/bin/bash

# 替换jar包里面的class文件/jar包/yaml等文件
# 用法：./tihuan.sh xxxx.jar A.class B.yaml C.jar ...

if [ -z "$1" ] || [ -z "$2" ]; then
  echo Usage: replace.sh xxx.jar xxx.class xxx.class ...
  exit 0
fi

jar="$1"
tmpname="temp-jar-${RANDOM}"

unzip -o -d /tmp/${tmpname} "${jar}" > /dev/null

shift 1
for i in ${*}; do
  pushd /tmp/${tmpname} > /dev/null
  readarray -d '' array < <(find . -name "${i}" -print0)
  popd > /dev/null

  file_count=${#array[@]}
  if [ $file_count -eq 0 ]; then 
    echo 未找到该文件，忽略
  elif [ $file_count -gt 1 ]; then
    echo ==========
    echo 找到多个文件，请选择需要替换的文件，如需同时替换，使用逗号分隔：
    for ((j=0; j<file_count; j++)); do
      echo $((j+1)) - ${array[j]}
    done
    IFS=, read -a pos
    for p in ${pos[@]}; do
      real_pos=$((p-1))
      echo cp "${i}" /tmp/${tmpname}/"${array[real_pos]}"
      cp "${i}" /tmp/${tmpname}/"${array[real_pos]}"
    done
  else
    echo cp "${i}" /tmp/${tmpname}/"${array[0]}"
    cp "${i}" /tmp/${tmpname}/"${array[0]}"
  fi
done

echo 替换完成，重新打包

dir=$(pwd)
newname="$(date +%y%m%d%H%M%S)-${jar}"
pushd /tmp/${tmpname} > /dev/null
zip -0 -r "${dir}/${newname}" * > /dev/null
popd > /dev/null
rm -rf /tmp/${tmpname}

echo
echo 打包完成！请根据需要运行下面命令：
echo
echo "# 替换软件包"
echo /bin/cp "${newname}" "${jar}"
echo /bin/rm "${newname}"
echo
echo "# 清理临时文件"
echo /bin/rm $*
```

保存为tihuan.sh，然后`chmod +x tihuan.sh`，之后可以按代码上方注释、运行代码时的输出提示这两者进行操作了。
