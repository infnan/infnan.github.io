---
layout: post
title: 找回丢失的Word表格边框
category: 教程
---
Word有一个奇葩bug：有很小的概率会发生表格边框全部消失的现象。如果表格数量太多，挨个表格补回边框肯定不现实，幸运的是，我们可以用宏来解决这个问题。

<!-- more -->

## 适用情况
整篇文档的表格都使用了统一的表格边框样式，例如全部为“所有框线”。与统一样式不同的特殊表格只能跑完程序手工处理。

## 操作步骤
1. 用鼠标右键点击功能区，在弹出菜单中选择“自定义功能区”。
![](/img/2020-09-14-word-table-border-recovery/word1.png)
2. 在弹出对话框中，右侧自定义功能区将“开发工具”打上对勾，确定。
3. 在功能区出现了“开发工具”，点进去，然后选择最左面的“Visual Basic”。
![](/img/2020-09-14-word-table-border-recovery/word2.png)
4. 在弹出的Visual Basic中，选择“插入”菜单中的“模块”选项。
5. 把本文后面的程序粘贴到里面。
6. 点击“运行”菜单中的“运行子过程/用户窗体”，在弹出的对话框中选择“恢复丢失的表线”。
7. 等程序运行完成。如果提示错误，那么需要回到Word，翻到指定页面手工处理一下。
8. 回到Visual Basic，对着左侧的“模块1”点右键，选择移除，然后选择否，把代码删除，免得保存时候麻烦。
![](/img/2020-09-14-word-table-border-recovery/word3.png)
9. 保存、备份。你总不想让边框再丢失了吧？

## 程序内容
### 所有框线
![](/img/2020-09-14-word-table-border-recovery/table1.png)

```vb
Sub 恢复丢失的表线()
    On Error GoTo e
    Dim msg As String, t As Table
    msg = ""
    For Each t In ActiveDocument.Tables
        t.Select
        With Selection.Borders(wdBorderTop)
            .LineStyle = Options.DefaultBorderLineStyle
            .LineWidth = Options.DefaultBorderLineWidth
            .Color = Options.DefaultBorderColor
        End With
        With Selection.Borders(wdBorderLeft)
            .LineStyle = Options.DefaultBorderLineStyle
            .LineWidth = Options.DefaultBorderLineWidth
            .Color = Options.DefaultBorderColor
        End With
        With Selection.Borders(wdBorderBottom)
            .LineStyle = Options.DefaultBorderLineStyle
            .LineWidth = Options.DefaultBorderLineWidth
            .Color = Options.DefaultBorderColor
        End With
        With Selection.Borders(wdBorderRight)
            .LineStyle = Options.DefaultBorderLineStyle
            .LineWidth = Options.DefaultBorderLineWidth
            .Color = Options.DefaultBorderColor
        End With
        With Selection.Borders(wdBorderHorizontal)
            .LineStyle = Options.DefaultBorderLineStyle
            .LineWidth = Options.DefaultBorderLineWidth
            .Color = Options.DefaultBorderColor
        End With
        With Selection.Borders(wdBorderVertical)
            .LineStyle = Options.DefaultBorderLineStyle
            .LineWidth = Options.DefaultBorderLineWidth
            .Color = Options.DefaultBorderColor
        End With
    Next
    
    If msg <> "" Then
        MsgBox "处理以下页面时发生错误，请复查：" & vbCrLf & msg, vbExclamation
    End If
    
    Exit Sub
e:
    msg = msg & Selection.Information(wdActiveEndAdjustedPageNumber) & vbCrLf
    Resume Next
End Sub
```

### 外边框加粗
假定边框1.5磅，内部0.5磅：

![](/img/2020-09-14-word-table-border-recovery/table2.png)

```vb
Sub 恢复丢失的表线()
    On Error GoTo e
    Dim msg As String, t As Table
    msg = ""
    For Each t In ActiveDocument.Tables
        t.Select
        With Selection.Borders(wdBorderLeft)
            .LineStyle = wdLineStyleSingle
            .LineWidth = wdLineWidth150pt
            .Color = wdColorAutomatic
        End With
        With Selection.Borders(wdBorderRight)
            .LineStyle = wdLineStyleSingle
            .LineWidth = wdLineWidth150pt
            .Color = wdColorAutomatic
        End With
        With Selection.Borders(wdBorderTop)
            .LineStyle = wdLineStyleSingle
            .LineWidth = wdLineWidth150pt
            .Color = wdColorAutomatic
        End With
        With Selection.Borders(wdBorderBottom)
            .LineStyle = wdLineStyleSingle
            .LineWidth = wdLineWidth150pt
            .Color = wdColorAutomatic
        End With
        With Selection.Borders(wdBorderHorizontal)
            .LineStyle = wdLineStyleSingle
            .LineWidth = wdLineWidth050pt
            .Color = wdColorAutomatic
        End With
        With Selection.Borders(wdBorderVertical)
            .LineStyle = wdLineStyleSingle
            .LineWidth = wdLineWidth050pt
            .Color = wdColorAutomatic
        End With
    Next
    
    If msg <> "" Then
        MsgBox "处理以下页面时发生错误，请复查：" & vbCrLf & msg, vbExclamation
    End If
    
    Exit Sub
e:
    msg = msg & Selection.Information(wdActiveEndAdjustedPageNumber) & vbCrLf
    Resume Next
End Sub
```

### 仅上、下和表头三条横线
假定边框1.5磅，内部0.5磅：

![](/img/2020-09-14-word-table-border-recovery/table3.png)

```vb
Sub 恢复丢失的表线()
    On Error GoTo e
    Dim msg As String, t As Table
    msg = ""
    For Each t In ActiveDocument.Tables
        t.Select

        With Selection.Borders(wdBorderTop)
            .LineStyle = wdLineStyleSingle
            .LineWidth = wdLineWidth150pt
            .Color = wdColorAutomatic
        End With
        With Selection.Borders(wdBorderBottom)
            .LineStyle = wdLineStyleSingle
            .LineWidth = wdLineWidth150pt
            .Color = wdColorAutomatic
        End With
        
        Selection.Borders(wdBorderLeft).LineStyle = wdLineStyleNone
        Selection.Borders(wdBorderRight).LineStyle = wdLineStyleNone
        Selection.Borders(wdBorderHorizontal).LineStyle = wdLineStyleNone
        Selection.Borders(wdBorderVertical).LineStyle = wdLineStyleNone
        
        If t.Rows.Count >= 2 Then
            t.Rows(1).Select
            With Selection.Borders(wdBorderBottom)
                .LineStyle = wdLineStyleSingle
                .LineWidth = wdLineWidth050pt
                .Color = wdColorAutomatic
            End With
        End If
    Next
    
    If msg <> "" Then
        MsgBox "处理以下页面时发生错误，请复查：" & vbCrLf & msg, vbExclamation
    End If
    
    Exit Sub
e:
    msg = msg & Selection.Information(wdActiveEndAdjustedPageNumber) & vbCrLf
    Resume Next
End Sub
```
