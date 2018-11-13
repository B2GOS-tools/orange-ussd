/* global window, MozActivity */
import React from 'react';
import BaseComponent from 'base-component';
import SimpleNavigationHelper from 'simple-navigation-helper';
import SoftKeyStore from 'soft-key-store';
import Service from 'service';
import Dialer from './dial_helper.js';
import Config from './config.js';

export default class MainView extends BaseComponent {
  DEBUG = false;
  name='main';

  constructor(props) {
    super(props);
    this.prefix = 'list';

    Dialer.on('mmiloading', this.showLoading.bind(this));
    Dialer.on('mmiloaded', this.showAlert.bind(this));
    Dialer.on('ussd-received', this.onUssdReceived.bind(this));
    Dialer.on('showDialog', this.showDialog.bind(this));
  }

  componentDidMount() {
    this.navigator = new SimpleNavigationHelper('.navigable', this.element);
    this.presetNumber().then((result) => {
      if (this.isUrl(result)) {
        this.loadUrl(result);
      } else {
        this.input.value = result;
      }
    });

    this.focus();
    this.updateSoftKeys();
  }

  isUrl(value) {
    let isUrl = /^http/.test(value);
    return isUrl;
  }

  loadUrl(url) {
    if (url && url !== '') {
      if (navigator.onLine) {
        this.debug(`navigator to ${url}`);
    //   window.open(url, '_self', 'remote=true');
        new MozActivity({
          name: 'view',
          data: {
            type: 'url',
            url: url,
            isPrivate: false
          }
        });
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        this.debug('Network error');
      }
    } else {
      this.debug(`Can not get url:${url}`);
    }
  }

  presetNumber() {
    let self = this;
    return new Promise((resolve, reject) => {
      let iccManager = navigator.mozIccManager;
      let conn = navigator.mozMobileConnections[0];
      let iccId = conn.iccId;
      let icc = iccManager.getIccById(iccId);

      if (icc) {
        // Genarate the key by mcc/mnc
        let key = icc.iccInfo.mcc + icc.iccInfo.mnc;
        this.debug(`key :${key}`);
        // Get config url string from settings db
        navigator.mozSettings.createLock().get(Config.KEY_USSDS).then((result) => {
          let value = result[Config.KEY_USSDS];
          this.debug(`result:${value}`);
          let ussds = Config.ussds;
          if (value) {
            ussds = JSON.parse(value);
          }
          this.debug(`ussds:${JSON.stringify(ussds)}`);
          let ussd = ussds[key];

          if (!ussd) {
            this.showDialog({
              type: 'alert',
              header: 'GenericFailure',
              content: 'insert-orange-sim-msg',
              translated: false,
              noClose: false
            });
            reject();
          } else {
            this.debug(ussd);
            resolve(ussd);
          }
        }, () => {
          self.debug('Get ussd from db error');
          reject();
        });
      } else {
        this.showDialog({
          type: 'alert',
          header: 'GenericFailure',
          content: 'insert-orange-sim-msg',
          translated: false,
          noClose: false
        });
      }
    });
  }

  updateSoftKeys() {
    let config = {};
    config.center = 'Call';
    SoftKeyStore.register(config, this.element);
  }

  focus() {
    this.debug(`focus ${this.input.value.length}`);
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    this.input.focus();
    this.updateSoftKeys();
  }

  showDialog(options) {
    this.debug(`showDialog options:${JSON.stringify(options)}`);
    Service.request('showDialog', {
      ...options,
      onOk: () => {
        this.focus();
      }
    });
  }

  showLoading() {
    this.debug('showLoading');
    Service.request('showDialog', {
      type: 'alert',
      header: 'send',
      content: 'sending',
      otherClass: 'is-loading',
      translated: true,
      noClose: false,
      onOk: () => {
        this.focus();
      }
    });
  }

  showAlert(title, message) {
    this.debug('showAlert');
    Service.request('Dialer:hide');
    if (!title && !message) {
      return;
    }
    Service.request('showDialog', {
      type: 'alert',
      header: title,
      content: message,
      translated: true,
      noClose: false,
      onOk: () => {
        this.focus();
      }
    });
  }

  onUssdReceived(evt) {
    this.debug('onUssdReceived');
    if (Dialer.mmiloading) {
      Service.request('hideDialog');
    }

    if (!evt.message) {
      // XXX: for debuging
      Service.request('showDialog', {
        type: 'alert',
        header: 'Error USSD case!',
        content: JSON.stringify(evt),
        translated: true,
        noClose: false,
        onOk: () => {
          this.focus();
        }
      });
      return;
    }

    let network = navigator.mozMobileConnections[evt.serviceId || 0].voice.network;
    let operator = network ? (network.shortName || network.longName) : '';
    Service.request('showDialog', {
      type: 'alert',
      header: operator,
      content: evt.message.replace(/\\r\\n|\\r|\\n/g, '\n'),
      translated: true,
      noClose: false,
      onOk: () => {
        this.focus();
      }
    });
  }

  onKeyDown(e) {
    this.debug(`onKeyDown key:${e.key}`);
    switch (e.key) {
      case 'Call':
      case 'Enter':
      case 'Backspace':
        Dialer.dial(this.input.value).then(() => {
  //        window.close();
        }, () => {
          this.debug('dial error');
        });
        break;
      default:
        break;
    }
  }

  render() {
    this.debug('render');
    return (<div
      id="list"
      ref={(c) => { this.element = c; }}
      onFocus={(e) => { this.focus(e); }}
      tabIndex="-1"
    >
      <div className="header h1">USSD Call</div>
      <input
        className="navigable" type="tel"
        ref={(c) => { this.input = c; }}
        onKeyDown={(e) => { this.onKeyDown(e); }}
      />
    </div>);
  }
}
