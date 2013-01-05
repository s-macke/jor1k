/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    lint: {
      files: ['grunt.js', 'js/**/*.js' //, 'test/**/*.js'*/
      ]
    },
    qunit: {
      files: ['test/**/*.html']
    },
    watch: {
      files: '<config:lint.files>',
      tasks: 'lint qunit'
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        browser: true
      },
      globals: {
        jQuery: true
      }
    }
    /*
    , concat: {
        lib: {
            src: [
                'js/prefix.js', 
                'js/terminal.js',
                'js/terminal-input.js',
                'js/framebuffer.js',
                'js/utils.js',
                'js/uart.js',
                'js/ram.js',
                'js/cpu.js',
                'js/system.js'
            ],
            dest: 'js/jor1k.js'
        }
    }
    */
  });

  // Default task.
  grunt.registerTask('default', /*concat*/ 'lint qunit');

  // Travis CI task.
  grunt.registerTask('travis', /*concat*/ 'lint qunit');
};
