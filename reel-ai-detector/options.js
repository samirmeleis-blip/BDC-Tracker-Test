const $ = (id) => document.getElementById(id);

chrome.storage.sync.get({ apiKey: "", model: "claude-opus-4-8" }).then((cfg) => {
  $("apiKey").value = cfg.apiKey;
  $("model").value = cfg.model;
});

$("save").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    apiKey: $("apiKey").value.trim(),
    model: $("model").value
  });
  $("status").textContent = "Saved.";
  setTimeout(() => ($("status").textContent = ""), 2000);
});
