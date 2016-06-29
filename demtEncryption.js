//class namespace  $Id: demtEncryption.js,v 1.1 2015/11/18 01:39:11 i20496 Exp $
var demEnc = (function() {
    var genDezKp = (demtcfg)?demtcfg.zipcode: true ;
    var demkeys;
    var encryptedToken = "Xicsc89821mlknvzjuuy";

    function reset() {
    	demkeys = null ;
    }

    /**
     * Get Security keys from server so that we can encrypt request in future
     */
    function getDemKeys(autoLogin) {
        if (!genDezKp || demkeys) return;

        var contextPath = window.location.pathname.split("/")[1];
        //-- "/"+contextPath+"/dem/EncryptionServlet?generateKeypair="+genDezKp; --
        var genKpUrl = "/" + contextPath + "/dem/jsp/demjcryption.jsp?generateKeypair=" + genDezKp;
        $.jCryption.getKeys(genKpUrl, function(receivedKeys) {
            demkeys = receivedKeys;
            if (autoLogin) autoLogin.call();
        });
    }

    /**
     * Called on Login Button clicked
     */
    function encryptPostData(postData, callBack) {
        if (!genDezKp) {
            callBack.call(window, postData);
            return;
        }

        var tokenStr = objToString(postData);
        $.jCryption.encrypt(tokenStr, demkeys, function(encrypted) {
            encryptedToken = encrypted;
            //postData.Passwd = encryptedPassword + '%' + postData.CompId + '%';
            // postData.token = {
            //     'token': encryptedToken
            // };

            callBack.call(window, {'token': encryptedToken});
        });

    }

    function objToString(obj) {
        var str = '';
        for (var p in obj) {
            if (obj.hasOwnProperty(p)) {
                str += p + ':' + obj[p] + ',';
            }
        }
        return str.substring(0, str.length - 1);
    }

    return {
    	encrypt: encryptPostData,
    	loadkeys: getDemKeys,
    	reset:reset
    } ;
})() ;
