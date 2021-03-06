/**
 * 处理自定义标签内无法显示```代码块的问题
 * @author haohuawu
 * @source https://github.com/hexojs/hexo/issues/2400#issuecomment-289037048
 */ 

const rEscapeContent = /<escape(?:[^>]*)>([\s\S]*?)<\/escape>/g;
const placeholder = '\uFFFD';
const rPlaceholder = /(?:<|&lt;)\!--\uFFFD(\d+)--(?:>|&gt;)/g;
const cache = [];

function escapeContent(str) {
    return '<!--' + placeholder + (cache.push(str) - 1) + '-->';
}

hexo.extend.filter.register('before_post_render', function (data) {
    data.content = data.content.replace(rEscapeContent, function (match, content) {
        return escapeContent(content);
    });
    return data;
});

hexo.extend.filter.register('after_post_render', function (data) {
    data.content = data.content.replace(rPlaceholder, function () {
        return cache[arguments[1]];
    });
    return data;
});
