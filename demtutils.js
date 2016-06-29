
function demGetUrlsuffix() {
		var bridge = demtcfg.isBridge() ;
    return bridge ? '.func' : '';
}

var dem = (function() {
    var counter = 0,
        currentPost = null,
        reqId = 0,
        repostPool = {},
        _host = '';
    window.repostPool = repostPool;

    function myAlert(msg, error) {
        if (msg) {
            toast(msg, error);
        }
    }


    function getLoginUrl() {
        return '/erp/dem/jsp/demjsignon.jsp' + demGetUrlsuffix();
    }

    function toast(message, error) {
        var $toast = $('<div class="ui-loader ui-overlay-shadow ui-body-e ui-corner-all"><h3>' + message + '</h3></div>'),
            opt = {
                display: 'block',
                background: '#fff',
                opacity: 0.90,
                position: 'fixed',
                padding: '7px',
                'text-align': 'center',
                width: '270px',
                left: ($(window).width() - 284) / 2,
                top: $(window).height() / 2 - 20
            };
        // if (error){
        //  opt.top = 5 ;
        //  opt['text-align']='left';
        // }
        $toast.css(opt);
        var removeToast = function() {
            $(this).remove();
        };

        $toast.click(removeToast);

        $toast.appendTo($.mobile.pageContainer);
        if (!error) {
            $toast.delay(3000);
            $toast.fadeOut(400, removeToast);
        }

    }

    function showMask(msg) {
        $.mobile.loading("show", {
            text: msg || "loading...",
            textVisible: true,
            theme: "z",
            html: ""
        });
    }

    function hideMask() {
        $.mobile.loading("hide", {
            text: "loading...",
            textVisible: true,
            theme: "z",
            html: ""
        });
    }

    function timeoutAndRepost(resp) {
        if (counter++ < 3) {
            var redo = function() {
                var _rq = resp.getResponseHeader('_rq');
                var postcontent = repostPool[_rq];
                if (!postcontent) {
                    console.error('_rq[' + _rq + '] has no content');
                    return;
                } else {
                    console.log('repost _rq[' + _rq + ']...');
                }
                showMask('relogin..');
                $.ajax(postcontent); // repost
            }
            signon4timeout(redo);
        } else {
            console.log('401 twice!');
        }
    }
    $.ajaxSetup({
        // contentType:'application/x-www-form-urlencoded; charset=UTF-8',
        statusCode: {
            401: function(resp) {
                timeoutAndRepost(resp);
            },
            500: function(resp) {
                toast(resp.responseText, true);
                counter = 0;
            },
            200: function(resp) {
                counter = 0;
                if (resp.i) {
                	if (resp.i.gk_js) {
                		if (resp.i.gk_js.indexOf('gk.sessionTimeOutHandler')>-1) {
                			location.href='../dem/demhApp.html';
                		}
                	}
                }
            },
            408: function() { // Request Timeout for secured token
                if (counter++ < 3) {
                    demEnc.reset();
                    demEnc.loadkeys(dem.autologin);
                }
            }
        },
        beforeSend: function(jqxhr, setting) {
            if (_host && /^\/erp\//.test(setting.url)) {
                setting.url = _host + setting.url;
            };
            jqxhr.setRequestHeader('dem-app-post', 'y');
            // skip those redo post
            var url = setting.url;
            if (url.indexOf('_rq=') == -1) {
                var conj = url.indexOf('?') > -1 ? '&' : '?';
                setting.url += conj + "_rq=" + (++reqId);
            }
            if (url.indexOf('signon.jsp') == -1) {
                repostPool[reqId] = setting;
            }
            showMask();
            console.log('sending...' + reqId + ', content:' + repostPool[reqId]);
        },
        complete: function(jqxhr, txtStatus) {
            console.log('finish!' + txtStatus);
            hideMask();
            if (jqxhr.status !== 401) {
                delete repostPool[jqxhr.getResponseHeader('_rq')];
            }
        }
    });

    function getValFromInfoOut(name, dataPaste) {
        var nameInfo = name.split('.');
        if (nameInfo.length == 2) { // vo.prop
            var vo = dataPaste[nameInfo[0]];
            if (!vo) {
                throw new Error('vo[' + nameInfo[0] + '] defined in fieldname not exists in infoOut[' + JSON.stringify(dataPaste) + ']');
            }
            return vo[nameInfo[1]];
        } else {
            return dataPaste[name];
        }
    }

    function setValFromInfoIn(name, val, dataPost) {
        var nameInfo = name.split('.');
        if (nameInfo.length == 2) { // vo.prop
            var dataKey = nameInfo[1] + '_' + nameInfo[0];
            dataPost[dataKey] = val;
        } else {
            dataPost[name] = val;
        }
    }

    var uiDataHandler = {
        "datetime-local": {
            toERP: function($field, dataPost) {
                var datas = $field.val().replace(/[-:]/g, '').split('T');
                var names = $field.prop('name').split('+');
                setValFromInfoIn(names[0], datas[0], dataPost);
                setValFromInfoIn(names[1], datas[1], dataPost);
            },
            toUI: function($field, dataPaste) {
                var flds = $field.prop('name').split('+'),
                    date = flds[0],
                    time = flds[1],
                    dateVal = getValFromInfoOut(date, dataPaste),
                    timeVal = getValFromInfoOut(time, dataPaste),
                    finalVal = rtn.util.toDateTimeISO(dateVal, timeVal);
                $field.val(finalVal);
            }
        },
        "date": {
            toERP: function($field, dataPost) {
                setValFromInfoIn($field.prop('name'), $field.val().replace(/[-]/g, ''), dataPost);
            },
            toUI: function($field, dataPaste) {
                var dateField = $field.prop('name'),
                    dateVal = getValFromInfoOut(dateField, dataPaste),
                    finalVal = rtn.util.toDateTimeISO(dateVal);
                $field.val(finalVal);
            }
        },
        "select": {
            toUI: function($field, dataPaste) {
                var fieldName = $field.prop('name'),
                    fieldVal = getValFromInfoOut(fieldName, dataPaste);
                $field.val(fieldVal).selectmenu('refresh');
            }
        },
        "empNo": {
            toERP: function($field, dataPost) {
                setValFromInfoIn($field.prop('name'), $field.val().replace(/\s+\S*$/, ''), dataPost);
            }
        },
        "radio": {
            toERP: function($field, dataPost) {
                if ($field.is(':checked')) {
                    var checkedValue = $field.filter(':checked').val();
                    setValFromInfoIn($field.prop('name'), checkedValue.replace(/\s+\S*$/, ''), dataPost);
                }
            },
            toUI: function($field, dataPaste) {
                var fieldName = $field.prop('name'),
                    fieldVal = getValFromInfoOut(fieldName, dataPaste);
                $field.filter('[value="' + fieldVal + '"]').prop('checked', true).checkboxradio("refresh");
            }
        }
    };

    function getUIDataHandler($input) {
        var uiType = ($input.attr('data-type') || $input.attr('type')) || 'select';
        var defOpt = {
            toERP: function($field, dataPost) {
                var val = $field.val();
                if (/{{\S+}}/.test(val)) { // clear select option value with {{xx}}
                    val = '';
                }
                setValFromInfoIn($field.prop('name'), val, dataPost);
            },
            toUI: function($field, dataPaste) {
                var val = getValFromInfoOut($field.prop('name'), dataPaste);
                $field.val(val);
            }
        };
        return $.extend(defOpt, uiDataHandler[uiType] || {});
    }

    function login2home(compId, userId, pwd, portalPage) {
        doLogin(compId, userId, pwd, function toHome() {
            $.mobile.changePage('#' + (portalPage || 'home'), {
                transition: 'flip',
                changeHash: false
            });
        });
    }


    function doLogin(compId, userId, pwd, callback) {
        var postdata = {
            UserId: userId,
            Passwd: pwd,
            CompId: compId,
            _AppId: 'demjsignon'
        };

        demEnc.encrypt(postdata, function(encodePostData) {
            $.post(_host + getLoginUrl(), encodePostData)
                .done(function(data, textStatus, jqXHR) {
                    if (data.indexOf('ok') > -1) {
                        callback(data);
                        //                    $.ajax(postSetting); // repost
                    } else {
                        myAlert('login fail:' + data);
                    }
                });
        })

    }

    function savePwd(compId, userId, pwd) {
        var data = enc(userId + 'c' + compId + 'd', pwd);
        saveData('_pwd', data);
    }

    function loadPwd(compId, userId) {
        var pwddata = loadData('_pwd');
        if (!pwddata) {
            return null;
        }
        return dec(userId + 'c' + compId + 'd', pwddata);
    }

    function signon4timeout(callback) {
        var compId = loadData('_compId'),
            userId = loadData('_userId'),
            pwd = loadPwd(compId, userId);

        $.post(_host + getLoginUrl(), {
                UserId: userId,
                Passwd: pwd,
                CompId: compId,
                _AppId: 'demjsignon'
            })
            .done(function(data, textStatus, jqXHR) {
                if (data.indexOf('ok') > -1) {
                    callback();
                } else {
                    myAlert('login fail:' + data);
                }
            });
    }

    function saveData(key, value) {
        window.localStorage.setItem(key, value);
    }

    function loadData(key) {
        return window.localStorage.getItem(key);
    }

    function enc(mykey, info) {
        return CryptoJS.AES.encrypt(info, mykey).toString();
    }

    function dec(mykey, encrypted) {
        if (window.CryptoJS){
            return CryptoJS.AES.decrypt(encrypted, mykey).toString(CryptoJS.enc.Utf8);
        } else {
            throw new Error("Module[CryptoJS] not loaded !") ;
        }
    }

    function clearLoginData() {
        window.localStorage.removeItem('_pwd');

    }

    var rtn = {
        setHost: function(host) {
            _host = host;
        },
        logout: function(loginPage) {
            clearLoginData();
            $.mobile.changePage('#' + (loginPage || 'Login'), {
                transition: 'flip',
                reverse: true
            });
        },
        autologin: function() {
            var userId = loadData('_userId'),
                compId = loadData('_compId'),
                pwd = loadPwd(compId, userId);
            if (userId) {
                $('#Login').find('[name="userId"]').val(userId);
            }
            if (compId) {
                $('#Login').find('[name="compId"]').val(compId);
            }
            if (compId && userId && pwd) {
                login2home(compId, userId, pwd, 'home');
            }
        },
        login: function(pageId, loginData, portalPage) {
            var $p = $('#' + pageId),
                info = loginData.split(',');
            if (info.length !== 3) {
                myAlert('infos[' + loginData + '] must have 3 fields: compId,userId,pwd');
                return;
            }
            var compId = $p.find('[name="' + info[0] + '"]').val(),
                $pwdField = $p.find('[name="' + info[2] + '"]'),
                userId = $p.find('[name="' + info[1] + '"]').val(),
                pwd = $pwdField.val();
            $pwdField.val('');

            var errmsg = [];
            if (!userId) {
                errmsg.push('userId is empty');
            }
            if (!pwd) {
                errmsg.push('password is empty');
            }
            if (errmsg.length > 0) {
                myAlert(errmsg.join("<br>"), true);
                return;
            }


            login2home(compId, userId, pwd, 'home');

            saveData('_compId', compId);
            saveData('_userId', userId);
            savePwd(compId, userId, pwd);

        },
        getCompId: function() {
            return loadData('_compId');
        },
        getUserId: function() {
            return loadData('_userId');
        },
        getDataPost: function($page, defaultData) {
            var data = {};
            $page.find(':input[name]').each(function() {
                var $t = $(this),
                    uiDataHandler = getUIDataHandler($t);
                uiDataHandler.toERP($t, data);
            });
            if (defaultData) {
                data = $.extend(defaultData, data);
            }
            // clean readonly fields
            var readonlyfields = $page.data('readonlyfields') || {};
            for (var k in readonlyfields) {
                var flds = readonlyfields[k];
                for (var i = 0, len = flds.length; i < len; i++) {
                    console.log('deleting ' + (flds[i] + "_" + k) + '...');
                    delete data[flds[i] + "_" + k];
                };
            }
            // clean array in case triggering setting method of vo
            for (var k in data) {
                if ($.isArray(data[k])) {
                    delete data[k];
                }
            }
            return data;
        },
        post: function(url, data, callback) {
            var sysId = url.charAt(2) === 'j' ? url.substring(0, 2) : url.substring(0, 3),
                info = url.split('.');
            var pageId = info[0],
                actionId = info[1],
                url = _host + '/erp/' + sysId + '/do' + demGetUrlsuffix() + '?_pageId=' + pageId + '&_action=' + actionId;
            if (!callback && $.isFunction(data)) {
                callback = data;
                data = {};
            }
            $.post(url, data,
                function(respData, status, jqxhr) {
                    var infoOut = JSON.parse(respData);
                    if (infoOut.error) {
                        myAlert(infoOut.message, true);
                    } else {
                        myAlert(infoOut.message);
                    }
                    if (callback) {
                        callback(infoOut, jqxhr);
                    }
                });
        },
        paste: function($page, out) {
            $page.find(':input[name]').each(function() {
                var $t = $(this),
                    uiDataHandler = getUIDataHandler($t);
                uiDataHandler.toUI($t, out);
            });
        },
        slidedown: function(transition) {
            $('body').pagecontainer('change', dem.prevPage, {
                transition: 'slidedown'
            });
            // $.mobile.changePage(, 'slidedown', true, true);
        }
    };

    function formatDate(num) {
        if (num < 10) {
            return "0" + num;
        }
        return num;
    }

    rtn.util = {
        toDateTimeISO: function(date, time /** date format: YYYYMMDD, time format: HHMM **/ ) {
            var len = date.length,
                day = date.substring(len - 2),
                month = date.substr(len - 4, 2),
                year = date.substring(0, len - 4),
                dateStr = year + '-' + month + '-' + day;
            if (!time) {
                return dateStr;
            }
            return dateStr + 'T' + time.substring(0, 2) + ':' + time.substring(2);
        },
        loadSelect: function($t, dynParam) {
            var datasrc = $t.attr('datasrc'),
                myParam = (dynParam || $t.attr('myParam')) || '',
                serviceUrl = '/erp/dem/svc/tagSelect/r/' + $t.attr('datasrc') + '/' + myParam;
            $t.gk().load(serviceUrl);
        }
    };

    return rtn;

})();
var demu = dem.util;
// record prevPage
$(document).on("pagecontainerbeforechange", function(event, data) {
    var toPage = data.toPage,
        prevPage = data.prevPage || "";
    if (prevPage) {
        dem.prevPage = prevPage;
    }
});
// init userPicker
function demjUserPicker_initApp(infoOut) {

}

$(document).on('pageinit', '#demjUserPicker', function(event, ui) {
    // $('#demuUserPickerBackBtn').on('click', function(){
    //  dem.slidedown();
    // }) ;
    $('#demuUserPickerOKBtn').on('click', function() {
        var $t = $(this),
            $rtn = $t.data('rtnTarget'),
            domObj = $('#demuUserNo')[0],
            opt = domObj.options[domObj.selectedIndex],
            val = opt.text;
        $rtn.val(val).focus();
    });
});

$(document).on('pageinit', function(event, ui) {
    var pageId = event.target.id,
        $page = $('#' + pageId);
    //   if(/^dem/.test(pageId)) {
    // demuUserPickerBackBtn

    //      return ;
    //   }

    // process empNo picker widget

    $page.find('input[data-type="empNo"]').on('click', function() {
        var $t = $(this),
            $userPicker = $('#demjUserPicker');
        $('body').pagecontainer('change', $userPicker, {
            transition: 'slideup'
        });
        $userPicker.find('#demuUserPickerOKBtn').data('rtnTarget', $t);
    });

    var initFunction = $page.attr('init-action') || pageId + '_initApp',
        pageFunc = initFunction;

    var appfunc = window[pageFunc];
    if (appfunc === undefined || $.isFunction(appfunc) === false) {
        console.info('function [' + pageFunc + '] not exists !');
        return;
    }

    // parse html to retrieve all <select>
    function retrieveSelectInfo() {
        var sels = [];
        $page.find('select[datasrc]').each(function() {
            var $t = $(this);
            sels.push({
                name: $t.prop('name'),
                datasrc: $t.attr('datasrc'),
                myParam: $t.attr('myParam') || ''
            });
        })
        return sels;
    }
    var pageInfo = {
            select: retrieveSelectInfo()
        },
        pageGlobal = $page.data('pageGlobal') || {};
    pageGlobal['_d_page'] = JSON.stringify(pageInfo);

    dem.post(initFunction.replace(/_/, '.'), pageGlobal, function(infoOut, jqxhr) {
        var $page = $('#' + pageId);
        dem.paste($page, infoOut);
        var rf = jqxhr.getResponseHeader('readonlyfields');
        if (rf) {
            $page.data('readonlyfields', JSON.parse(rf));
        }

        // process widget datasrc
        var wd = infoOut._widget_data;
        if (wd) {
            if (wd.hasOwnProperty('select')) {
                for (var name in wd.select) { // loop all select
                    $('select[name="' + name + '"]').each(function() {
                        var $t = $(this),
                            $gkSel = $t.gk(),
                            model = wd.select[name],
                            first = $t.attr('first');
                        if (first) {
                            model.unshift({
                                value: '',
                                text: first
                            });
                        }
                        $t.selectmenu();
                        $gkSel.model(wd.select[name]);
                        // handle cascade selects
                        var rmClass = $t.attr('rmClass');
                        if (rmClass) {
                            $t.on('change', function() {
                                $(this).demselect('loadChild', $page);
                            })
                        }
                    })
                }
            }
            delete infoOut._widget_data;
        }

        $page.data('pageGlobal', infoOut);
        // trigger AP page function
        appfunc.apply(this, [infoOut]);
    });


});

(function(fn) {
    fn.demselect = function(mth, myParam) {
        var $t = this;
        var method = {
            reload: function(param) {
                var myParam = (param || $t.attr('myParam')) || '';
                var datasrc = $t.attr('datasrc'),
                    serviceUrl = '/erp/dem/svc/tagSelect/r/' + datasrc + '/' + myParam + demGetUrlsuffix();
                $t.gk().load(serviceUrl);
            },
            loadChild: function($page) {
                var rmClass = $t.attr('rmClass'),
                    val = $t.val(),
                    data = dem.getDataPost($page),
                    $child = $('select[name="' + $t.attr('child') + '"]'),
                    serviceUrl = '/erp/dem/svc/tagRemote/r/' + rmClass + '/' + val + demGetUrlsuffix();

                $.getJSON(serviceUrl).complete(function(data) {
                    var opts = $.parseJSON(data.responseText);
                    if (opts.length == 0) {
                        $child.closest('.ui-field-contain').hide();
                    } else {
                        $child.closest('.ui-field-contain').show();
                        $child.gk().model(opts);
                    }
                });
            }
        };

        var action = method[mth];
        if (!action) {
            console.error('demselect.' + mth + ' not exists !');
        } else {
            action(myParam);
        }
    }

    fn.dempage = function(mth, arg2, arg3) {
        var $t = this,
            method = {
                post: function(para, callback) {
                    var pageId = $t.attr('id'),
                        globalData = $t.data('pageGlobal'),
                        vos = [];
                    // move vo to field naming with '$fieldname_$voId'    
                    for (var p in globalData) {
                        var val = globalData[p];
                        if ($.isPlainObject(val)) {
                            vos.push(p);
                            for (var fieldName in val) {
                                var fldval = val[fieldName];
                                globalData[fieldName + '_' + p] = fldval;
                            }
                        }
                    }
                    $.each(vos, function(idx, val) {
                        // clear in case of submit
                        delete globalData[val];
                    });
                    var pageAction = (para.indexOf('.') > -1) ? para : pageId + '.' + para;
                    dem.post(pageAction, dem.getDataPost($t, globalData), callback);
                },
                param: function(name, val) {
                    var globalData = $t.data('pageGlobal') || {};
                    globalData[name] = val;
                    $t.data('pageGlobal', globalData);
                }
            },
            action = method[mth];
        if (!action) {
            console.error('dempage.' + mth + ' not exists !');
        } else {
            var args = Array.prototype.slice.call(arguments);
            args.shift();
            action.apply($t, args);
        }

    }

})(jQuery.fn);
