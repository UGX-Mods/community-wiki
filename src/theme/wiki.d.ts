// globals of the wiki.js 2 client the theme script uses

interface Window {
  boot: {
    register(event: 'page-ready' | (string & {}), callback: () => void): void;
  };
}
