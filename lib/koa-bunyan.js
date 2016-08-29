'use strict'

var util = require( 'util' )

module.exports = function ( logger, opts ) {
	opts = opts || {}

	var level = opts.level || 'info'
	var requestTimeLevel = opts.timeLimit

	return function *( next ) {
		var startTime = new Date().getTime()
		var ctx = this

		if( ! opts.catchErrors ) {

			var d = {
				type: 'request',
				method: ctx.method,
				url: ctx.originalUrl,
			}
			if( !! ctx.app && !! ctx.app.env ) d.env = ctx.app.env
			if( !! ctx.params ) d.params = ctx.params
			if( level == 'debug' && !! ctx.request && !! ctx.request.body )
				d.body = ctx.request.body

			logger[ level ]( d, util.format( '<-- %s %s', ctx.method, ctx.url ) )

		}

		var done = function() {

			if( !! opts.catchErrors ) return
			var requestTime = new Date().getTime() - startTime
			var localLevel = level

			var slow = requestTimeLevel && requestTime > requestTimeLevel
			if( slow ) localLevel = 'warn'

			var ok = ctx.status < 400
			if( ! ok ) return // below try catch is designed to capture all errors
			var prefix = ok ? '-->' : 'xxx'
			var d = {
				type: 'response',
				duration: requestTime,
				method: ctx.method,
				url: ctx.originalUrl,
				status: ctx.status,
			}
			if( ! ok ) d.error = true
			if( !! slow ) d.slow = true
			if( !! ctx.response && !! ctx.response.message )
				d.message = ctx.response.message
			if( !! ctx.app && !! ctx.app.env ) d.env = ctx.app.env
			if( level == 'debug' && !! ctx.response && !! ctx.response.body )
					d.body = ctx.response.body

			logger[ localLevel ]( d, util.format( prefix + ' %s %s (%s) took %s ms',
					ctx.method, ctx.originalUrl, ctx.status, requestTime ) )
		}

		ctx.res.once( 'finish', done )
		ctx.res.once( 'close', done )

		try {
			yield next
		} catch( err ) {

			if( ! opts.catchErrors ) return
			var requestTime = new Date().getTime() - startTime
			var errLevel = 'error'

			// log original request before downstream error
			var d = {
				type: 'request',
				method: ctx.method,
				url: ctx.originalUrl,
				error: true,
			}
			if( !! ctx.app && !! ctx.app.env ) d.env = ctx.app.env
			if( !! ctx.params ) d.params = ctx.params
			if( level == 'debug' && !! ctx.request && !! ctx.request.body )
				d.body = ctx.request.body

			logger[ errLevel ]( d, util.format( '<-- %s %s', ctx.method, ctx.url ) )

			// log uncaught downstream errors
			d = {
				type: 'response',
				method: ctx.method,
				url: ctx.originalUrl,
				status: err.status || err.statusCode,
				errorMessage: err.message,
				error: true,
			}
			if( !! ctx.app && !! ctx.app.env ) d.env = ctx.app.env
			if( !! ctx.params ) d.params = ctx.params
			if( !! ctx.request && !! ctx.request.body ) d.body = ctx.request.body

			logger[ errLevel ]( d, util.format( 'xxx %s %s (%s) took %s ms', ctx.method, ctx.url, err.status || err.statusCode, requestTime ) )

			throw err
		}

	}
}
