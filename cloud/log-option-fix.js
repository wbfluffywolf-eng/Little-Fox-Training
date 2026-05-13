const catheterStentOption = {
  value: "catheter_stent_use",
  label: "Catheter / stent use"
};

function addCatheterStentOption(select) {
  if (!select || select.querySelector(`option[value="${catheterStentOption.value}"]`)) return;
  const option = document.createElement("option");
  option.value = catheterStentOption.value;
  option.textContent = catheterStentOption.label;
  select.appendChild(option);
}

function patchLogSubcategorySelects() {
  document.querySelectorAll('select[name="subcategory"]').forEach(addCatheterStentOption);
}

new MutationObserver(patchLogSubcategorySelects).observe(document.getElementById("app"), {
  childList: true,
  subtree: true
});

patchLogSubcategorySelects();
