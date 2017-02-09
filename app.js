//moduli jossa mukana ngRoute reititystä varten
var studentApp = angular.module('studentApp', ['ngRoute']);
// configure our routes
studentApp.run();//ajetaan aina käynnistyksessä run()

studentApp.config(function ($routeProvider, $httpProvider) {
    //AuthInterceptor on alempana määritelty factory
    $httpProvider.interceptors.push('AuthInterceptor');
    $routeProvider

            .when('/', {
                templateUrl: 'pages/show.html',
                controller: 'showController'
            })

            .when('/login', {
                templateUrl: 'pages/login.html',
                controller: 'loginController'
            })

            .when('/admin', {
                templateUrl: 'pages/admin.html',
                controller: 'adminController'

            });
});

/*AuthInterceptor laittaa tokenin jokaisen lähtevän http-pyynnön headeriin
 * siinä muodossa jossa backend sen ottaa vastaan. Kyseessä siis normaali
 * service/factory joka otetaan käyttöön config-osassa lisäämällä se interceptors
 * taulukkoon.
 */
studentApp.factory('AuthInterceptor', function() {
  return {
    request: function(config) {
      var token;
      token = window.sessionStorage['student-app-token'];
      if (token) {
        config.headers['x-access-token'] = token;
      }
      return config;
    }
  };
});

/* run-funktiossa tutkitaan $locationChangeStart -olion avulla
 * ollaanko vaihtamassa sivua. Jos ollaan vaihtamassa sivua ja 
 * mennään suojatulle sivulle ja tokenia ei ole, niin ei päästetä 
 * sivulle.
 */

studentApp.run(function ($rootScope, $http, $location, $window, authService) {
    $rootScope.$on('$locationChangeStart', function (event, next, current) {
        var BASEURL = 'http://localhost:8383/WSK2T12/index.html#/';
        if (authService.isLoggedIn() == false) {
            if (next ==  BASEURL + 'admin') {
                $location.path('/login')
            } else {
                $window.location.href = BASEURL;
            }
        } else {
            $window.location.href = next;
        }
    });
});


/*
 * authService huolehtii sovelluksen autentikaatiosta
 * otetaan vastaan web token ja katsotaan että kyseessä on
 * varmasti se token joka on tullut palvelimelta.
 * Token tallennetaan sessionStorageen jossa se on voimassa
 * niin kauan kuin selain on auki.
 * 
 * $http:llä saadaan tavara serveriltä
 * $window:lla päästään käsiksi sessionstorageen
 */
studentApp.factory('authService', function ($http, $window) {
    
    var BASE = 'https://wsk2t16.herokuapp.com/users';
    var authService = {};

    //Sisäänkirjautuminen
    authService.logIn = function (user) {
        $http.post(BASE + '/authenticate', user).success(function (data) {
            authService.saveToken(data.token);
        });
    };

    //Tokenin tallennus sessionStorageen
    authService.saveToken = function (token) {
        $window.sessionStorage['student-app-token'] = token;
    };

    //Tokenin haku sessionStoragesta
    authService.getToken = function () {
        return $window.sessionStorage['student-app-token'];
    };

    authService.isLoggedIn = function () {
        var token = authService.getToken();
        if (token) {
            //Otetaan tokenista keskimmäinen osa, jota voidaan käyttää tunnistamiseen
            var payload = JSON.parse($window.atob(token.split('.')[1]));
            return payload.exp > Math.floor(Date.now() / 1000);
        } else {
            return false;
        }
    };
    return authService;
});

/*
 * Kaikki yhteydet backendiin ovat dataservicessä
 * controllerin scope-funktiot käyttävät dataserviceä
 * controllerin funktiot ovat saman nimisiä kuin dataservicessä
 * 
 * factory palauttaa funktioita jotka palauttavat promisen
 */

studentApp.factory('dataService', function ($http, authService) {


    return {
        read: function () {
            //palautetaan promise         
            return $http.get('https://wsk2t16.herokuapp.com/users')
                    .then(function (result) {
                        return result.data;
                    });

        },
        create: function (formdata) {
            //lähetetään data backendiin, palautetaan promise
            return  $http({
                method: 'post',
                url: 'https://wsk2t16.herokuapp.com/users/create',
                data: formdata
            }).then(function (result) {
                return result.data;

            });
        },
        del: function (student) {
            /*Käytetään post pyyntöä datan lähettämiseen backendiin,
             *siellä käsitellään pyyntö ja poistetaan opiskelijan tiedot
             *mikäli ne löytyvät kannasta.
             */
            return $http({
                method: 'post',
                url: 'https://wsk2t16.herokuapp.com/users/delete',
                data: student
            }).then(function (result) {
                return result.data;
            });
        },
        update: function (formdata) {
            return $http({
                method: 'put',
                url: 'https://wsk2t16.herokuapp.com/users/update',
                data: formdata
            }).then(function (result) {
                return result.data;
            });
        }
    };
});




//etusivun controller
studentApp.controller('showController', ['$scope', 'dataService', function ($scope, dataService) {

        //promisen käyttö
        dataService.read().then(function (data) {
            $scope.students = data;
        });
    }]);



//login-sivun controller hakee tunnarit login-sivulta ja välittää ne authServiceen
studentApp.controller('loginController', ['$scope', 'authService', function ($scope, authService) {

        $scope.user = {};
        $scope.login = function () {
            authService.logIn($scope.user)
        };

    }]);

//admin-sivun controller
studentApp.controller('adminController', ['$scope', 'dataService', function ($scope, dataService) {

        //Nappien alkutilanne
        $scope.createbtn = true;
        $scope.updatebtn = false;

        $scope.read = function () {

            dataService.read().then(function (data) {
                $scope.students = data;
            });

        };

        $scope.read();//luetaan uusin data aina ensin kun tullaan admin-tilaan


        $scope.create = function () {

            dataService.create($scope.formdata).then(function () {
                $scope.formdata = {};
                $scope.read();
            });

        };


        $scope.del = function (student) {
            dataService.del(student);
        };

        /*
         * updateform -napin painaminen laittaa muokattavat tiedot scopeen
         * jolloin ne näkyvät viewissä muokkauslomakkeella.
         * Tässä siis ladataan data muokkauslomakkeelle
         * update-funktio vie datan kantaan ja hakee kannasta päivittyneen 
         * datan joka laitetaan scopeen ja scope ladataan uudestaan
         */
        $scope.updateform = function (student) {

            $scope.formdata = {};//määritellään formdata -taulukko ja tyhjennetään jos on jo olemassa       

            $scope.formdata._id = student._id;
            $scope.formdata.opiskelijanumero = student.opiskelijanumero;
            $scope.formdata.nimi = student.nimi;
            $scope.formdata.email = student.email;
            $scope.formdata.opintopisteet = student.opintopisteet;

            $scope.createbtn = false;
            $scope.updatebtn = true;


        };

        $scope.update = function () {
            dataService.update($scope.formdata);
            $scope.formdata = {};
            $scope.read();
        };

    }]);


