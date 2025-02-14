import generateAuthHeader from './generateCode/auth';
import formatEnv from './formatEnv';

class BodyParser {
  constructor(body) {
    this.body = body;
    this.mime = body.mimeType;
  }

  __parseJSON() {
    if (!this.body.text) {
      return;
    }

    this.body.text = this.body.text.replace(new RegExp('{{.*}}', 'g'), '"!!Missing declaration in environment!!"');
    let text;

    try {
      text = JSON.stringify(JSON.parse(this.body.text), null, 2);
    } catch (_) {
      console.warn('Failed to parse JSON body (expect incorrect tokenization):', this.body.text);
      text = this.body.text;
    }

    return {
      type: 'plain',
      note: 'json',
      text: `<pre>${text}</pre>`
    };
  }

  __parseMultipart() {
    const rows = this.body.params.map(p => {
      return {
        name: p.name,
        value: p.value,
        description: p.description
      };
    });

    return {
      type: 'array',
      note: 'formdata',
      rows
    };
  }

  __parseXML() {
    var beautifiedXmlText = new XmlBeautify().beautify(this.body.text,
      {
        indent: "  ", //indent pattern like white spaces
        useSelfClosingElement: true //true:use self-closing element when empty element.
      });
    var escapedXmlText = this.__escapeXml(beautifiedXmlText);
    return {
      type: 'plain',
      note: 'XML',
      text: `<pre lang="xml">${escapedXmlText}</pre>`
    };
  }

  __parsePlain() {
    return {
      type: 'plain',
      note: 'raw',
      text: `<pre></pre>`
    };
  }

  parse() {
    switch (this.mime) {
      case 'application/json':
        return this.__parseJSON();
      case 'application/xml':
        return this.__parseXML();
      case 'multipart/form-data':
      case 'application/x-www-form-urlencoded':
        return this.__parseMultipart();
      default:
        return this.__parsePlain();
    }
  }

  __escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }
}

class ContentGenerator {
  constructor(req) {
    this.req = req;
  }

  params() {
    const rows = [];

    this.req.parameters.forEach(param => {
      rows.push({
        name: param.name,
        value: param.value,
        description: param.description
      });
    });

    return {
      title: 'Parameters',
      rows
    };
  }

  headers() {
    const rows = [];

    this.req.headers.forEach(header => {
      rows.push({
        name: header.name,
        value: formatEnv(header.value || ''),
        description: header.description
      });
    });

    if (this.req.authentication && this.req.authentication.type) {
      const authHeader = generateAuthHeader(this.req.authentication);

      rows.push({
        name: authHeader.name,
        value: `<pre>${formatEnv(authHeader.value)}</pre>`
      });
    }

    return {
      title: 'Headers',
      rows
    };
  }

  body() {
    const parser = new BodyParser(this.req.body);
    const data = parser.parse();

    switch (data.type) {
      case 'array':
        return {
          title: 'Body',
          note: data.note,
          rows: data.rows
        };
      case 'plain':
        return {
          title: 'Body',
          note: data.note,
          text: data.text
        };
    }
  }
}

export default ContentGenerator;
