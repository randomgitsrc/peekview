# Unicode 文件名资源引用（TPV0089 fixture）

本 entry 用于端到端验证非 ASCII 文件名本地资源的链接解析修复（BDD-10~13）。

## 中文文件名图片

![中文图片](images/中文图片.png)

## 日文文件名图片

![日文概要図](images/概要図.png)

## 带重音拉丁字符文件名图片

![café](images/café.png)

## 含空格文件名图片

![report final](<images/report final.png>)

## 英文文件名图片（回归对照）

![arch](images/arch.png)

## 附件链接

- [中文附件下载](images/报告附件.txt)
- [English attachment](images/english-notes.txt)

## 说明

上面的图片与附件均通过相对路径引用。文件名含中文 / 日文 / 重音拉丁字符 / 空格，
修复前 markdown-it 会将其 percent-encode（如 `images/%E4%B8%AD%E6%96%87...png`），
`resolvePath` 因缺少 decode 而匹配失败，导致图片裂图 / 链接死链；修复后应全部正常渲染。
