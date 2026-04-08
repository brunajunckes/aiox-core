'use strict';

/**
 * {{Name}} Component
 * @description {{description}}
 * @author {{author}}
 * @date {{date}}
 */

function {{Name}}(props = {}) {
  return {
    name: '{{name}}',
    render() {
      return `<div class="{{name}}">${JSON.stringify(props)}</div>`;
    },
  };
}

module.exports = { {{Name}} };
