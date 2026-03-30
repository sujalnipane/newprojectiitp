function generateWebsite() {
    const prompt = document.getElementById("promptInput").value;

    const status = document.getElementById("status");
    status.innerText = "Generating... ⚡";

    fetch("/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt: prompt })
    })
    .then(res => res.json())
    .then(data => {
        if (data.result) {
            status.innerText = "Done ✅";

            
            const newWindow = window.open();
            newWindow.document.open();
            newWindow.document.write(data.result);
            newWindow.document.close();
            downloadWebsite(data.result);

        } else {
            status.innerText = "Error ❌";
            alert(data.error);
        }
    })
    .catch(err => {
        console.error(err);
        status.innerText = "Error ❌";
    });
}
function downloadWebsite(content) {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "website.html";
    a.click();

    URL.revokeObjectURL(url);
}