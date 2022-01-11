const fs = require('fs');
const yaml = require('js-yaml');

const conf = yaml.safeLoad(fs.readFileSync('./_config.yml', 'utf-8'), {
    schema: yaml.DEFAULT_FULL_SCHEMA,
});

// 预览时不要压缩，浪费时间
const minfiers = ['html_minifier', 'js_minifier', 'css_minifier', 'image_minifier'];
for (const minifier of minfiers) {
    if (conf[minifier]) {
        conf[minifier].enable = false;
    }
}

fs.writeFileSync('./_config.tmp.yml', yaml.safeDump(conf, {
    schema: yaml.DEFAULT_FULL_SCHEMA,
}));
